import pandas as pd
import numpy as np
import pytz
from datetime import timedelta
from timezonefinder import TimezoneFinder
from opencage.geocoder import OpenCageGeocode
from haversine import haversine, Unit
from datetime_utils import haversine_distance

API_KEY = "739d7e8fc5fb469695735ae8fe6d5952"

def convert_to_timezone_aware(city, state, naive_datetime):
    """
    Given a city and state along with a naive datetime, return a timezone-aware datetime.
    """
    geocoder = OpenCageGeocode(API_KEY)
    tf = TimezoneFinder()
    location_name = f"{city}, {state}"
    
    results = geocoder.geocode(location_name)
    if not results:
        raise ValueError(f"Could not find location: {location_name}")
    
    latitude = results[0]['geometry']['lat']
    longitude = results[0]['geometry']['lng']
    
    timezone_str = tf.timezone_at(lat=latitude, lng=longitude)
    if not timezone_str:
        raise ValueError(f"Could not find timezone for location: {location_name}")
    
    timezone = pytz.timezone(timezone_str)
    return timezone.localize(naive_datetime)

def process_fuel_data(fuel_filepath):
    """
    Reads the fuel CSV file, converts date and time into a timezone-aware datetime ("Dt"),
    drops rows with missing location data, and applies timezone conversion for each record.
    Returns the processed fuel DataFrame.
    """
    fuel_df = pd.read_csv(fuel_filepath, dtype={'Equipment Ref No': str, 'Missing Driver Reference': object})
    
    # Convert to datetime using the existing helper (assumed to be imported in main or processed earlier)
    from helpers.datetime_utils import convert_to_datetime
    fuel_df = convert_to_datetime(fuel_df, 'Date', 'Time', 'Dt')
    
    fuel_df.dropna(subset=['Latitude'], inplace=True)
    fuel_df.dropna(subset=['Longitude'], inplace=True)
    fuel_df['unit_tank'] = np.nan
    fuel_df['dwell_time'] = np.nan
    fuel_df['assigned'] = False

    tf = TimezoneFinder()
    for idx, row in fuel_df.iterrows():
        if pd.isna(row['Latitude']) or pd.isna(row['Longitude']):
            # Use location-based conversion if coordinates are missing
            aware_dt = convert_to_timezone_aware(row['City'], row['State'], row['Dt'])
            fuel_df.at[idx, 'Dt'] = aware_dt.astimezone(pytz.UTC)
        else:
            lat, lon = row['Latitude'], row['Longitude']
            tz_str = tf.timezone_at(lng=lon, lat=lat)
            if tz_str:
                target_timezone = pytz.timezone(tz_str)
                localized_time = row['Dt'].replace(tzinfo=target_timezone)
                fuel_df.at[idx, 'Dt'] = localized_time.astimezone(pytz.UTC)
    return fuel_df

def match_small_fuel_transactions(
    stops_df,         # DataFrame of stops (one row per stop)
    fuel_df,          # DataFrame of fuel transactions
    truck,            # Equipment Ref No of interest
    tank_increase_threshold=0.05,
    time_margin=360   # minutes before/after a stop's window to consider matching
):
    """
    For each unassigned fuel transaction for the specified truck, search for stops that:
      - have at least 'tank_increase_threshold' of fuel increase,
      - occur within ± 'time_margin' minutes of the stop,
      - and are within 5 miles of the transaction location.
    Matches the transaction to the closest qualifying stop.
    """
    stops_truck = stops_df[stops_df['Tractor No'] == truck].copy()
    if 'tank_change' not in stops_truck.columns:
        stops_truck['tank_change'] = stops_truck['Fuel Tank Percent After'] - stops_truck['Fuel Tank Percent Before']

    # Filter stops to those with sufficient tank increase and not already classified as fuel stops
    candidate_stops = stops_truck[
        (stops_truck['tank_change'] >= tank_increase_threshold) &
        ((stops_truck['Stop Type'] != 'fuel') | (stops_truck['Stop Type'] != 'fuel ext'))
    ].copy()

    fuel_truck = fuel_df[(fuel_df['Equipment Ref No'] == truck) & (fuel_df['assigned'] == False)].copy()
   
    for tx_idx, tx_row in fuel_truck.iterrows():
        tx_time = tx_row['Dt']
        tx_lat, tx_lon = tx_row['Latitude'], tx_row['Longitude']

        time_min = tx_time - timedelta(minutes=time_margin)
        time_max = tx_time + timedelta(minutes=time_margin)

        time_filtered = candidate_stops[
            (candidate_stops['Arrival Datetime'] <= time_max) &
            (candidate_stops['Arrival Datetime'] >= time_min)
        ].copy()

        if time_filtered.empty:
            continue

        time_filtered['distance_miles'] = time_filtered.apply(
            lambda s: haversine((s['Latitude'], s['Longitude']), (tx_lat, tx_lon), unit=Unit.MILES),
            axis=1
        )

        best_stop_idx = time_filtered['distance_miles'].idxmin()
        best_stop_dist = time_filtered.loc[best_stop_idx, 'distance_miles']

        if best_stop_dist <= 5:
            fuel_df.loc[tx_idx, 'assigned'] = True
            stop_tank_change = time_filtered.loc[best_stop_idx, 'tank_change']
            unit_tank = tx_row['Quantity'] / stop_tank_change if stop_tank_change != 0 else 0
            fuel_df.loc[tx_idx, 'unit_tank'] = unit_tank
            fuel_df.loc[tx_idx, 'dwell_time'] = time_filtered.loc[best_stop_idx, 'Dwell Time']
            stops_df.loc[best_stop_idx, 'Stop Type'] = 'fuel'
            stops_df.loc[best_stop_idx, 'Quantity'] = tx_row.get('Quantity', None)
            stops_df.loc[best_stop_idx, 'Location name'] = tx_row.get('Location name', None)
            stops_df.loc[best_stop_idx, 'Unit Price'] = tx_row.get('Unit Price', None)
            stops_df.loc[best_stop_idx, 'Total Price'] = tx_row.get('Total Price', None)
            stops_df.loc[best_stop_idx, 'City'] = tx_row.get('City', None)
            stops_df.loc[best_stop_idx, 'State'] = tx_row.get('State', None)
   
    return stops_df, fuel_df

def normalize_fuel_locations(df, distance_threshold_m=3000):
    """
    Normalizes fuel transaction locations by grouping on (Location ID, Location name),
    excluding outliers that are further than distance_threshold_m from the group's mean,
    and updating all rows in the group to the computed mean location.
    Marks each row with a new boolean column 'verified_location'.
    """
    df = df.copy()
    df['verified_location'] = False
    group_cols = ['Location ID', 'Location name']
    grouped = df.groupby(group_cols, group_keys=False)

    def process_group(subdf):
        verified_mask = subdf['unit_tank'].notna() & (subdf['unit_tank'] != '')
        verified_sub = subdf[verified_mask]
        if verified_sub.empty:
            return subdf
        mean_lat = verified_sub['Latitude'].mean()
        mean_lon = verified_sub['Longitude'].mean()
        distances = verified_sub.apply(
            lambda row: haversine_distance(
                row['Latitude'], row['Longitude'],
                mean_lat, mean_lon
            ),
            axis=1
        )
        keep_mask = distances <= distance_threshold_m
        verified_sub_inliers = verified_sub[keep_mask]
        if verified_sub_inliers.empty:
            return subdf
        final_lat = verified_sub_inliers['Latitude'].mean()
        final_lon = verified_sub_inliers['Longitude'].mean()
        subdf['Latitude'] = final_lat
        subdf['Longitude'] = final_lon
        subdf['verified_location'] = True
        return subdf

    df = grouped.apply(process_group).reset_index(drop=True)
    return df
