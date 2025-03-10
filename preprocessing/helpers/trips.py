import math
import numpy as np
import pandas as pd
import simplejson
from datetime import timedelta
from haversine import haversine, Unit
from opencage.geocoder import OpenCageGeocode

# Use the same API key as defined elsewhere
API_KEY = "739d7e8fc5fb469695735ae8fe6d5952"

def filter_long_stops(stops_df):
    """
    Filters stops_df to include only long stops that do not have any 'rest_area'
    in their nearestX_highway columns.
    """
    df_long = stops_df[stops_df['Stop Type'] == 'long'].copy()
    nearest_cols = [f'nearest{i}_highway' for i in range(1, 11)]
    
    def is_rest_area(row):
        for col in nearest_cols:
            val = row.get(col, None)
            if val and val == 'rest_area':
                return True
        return False

    df_long['is_rest_area'] = df_long.apply(is_rest_area, axis=1)
    df_long = df_long[~df_long['is_rest_area']].copy()
    df_long.drop(columns=['is_rest_area'], inplace=True)
    return df_long

def geocode_latlon(lat, lon):
    """
    Uses OpenCageGeocode to return location details (city, state, country, postal code)
    for the given latitude and longitude.
    """
    try:
        geocoder = OpenCageGeocode(API_KEY)
        results = geocoder.reverse_geocode(lat, lon)
        if results and len(results) > 0:
            print('Getting location for...', lat, lon)
            comp = results[0]['components']
            city = comp.get('city') or comp.get('town') or comp.get('village') or ''
            state = comp.get('state','')
            country = comp.get('country','')
            postcode = comp.get('postcode','')
            return city, state, country, postcode
    except Exception as e:
        print(f'Geocoding failed for {lat}, {lon}: {e}')
    return '', '', '', ''

def enrich_long_stops_with_location(df_long):
    """
    For each long stop in df_long, use geocoding to add columns:
      City, State, Country, and Postal Code.
    """
    for idx, row in df_long.iterrows():
        lat = row['Latitude']
        lon = row['Longitude']
        city, state, country, postcode = geocode_latlon(lat, lon)
        df_long.at[idx, 'City'] = city
        df_long.at[idx, 'State'] = state
        df_long.at[idx, 'Country'] = country
        df_long.at[idx, 'Postal Code'] = postcode
    df_long.sort_values(by=['Tractor No', 'Arrival Datetime'], inplace=True)
    return df_long

def haversine_miles(lat1, lon1, lat2, lon2):
    """
    Returns the distance in miles between two latitude/longitude points.
    """
    R = 3958.8  # Earth radius in miles
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = (math.sin(dLat/2)**2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dLon/2)**2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def build_trip_records(df_long):
    """
    From the enriched long stops DataFrame, build trip (dispatch) records.
    For each tractor group, pairs consecutive stops and only records a trip if
    the distance between stops is at least 20 miles.
    Returns a DataFrame of trip records.
    """
    records = []
    for tractor_id, group in df_long.groupby('Tractor No', sort=False):
        group = group.sort_values('Arrival Datetime')
        rows = group.to_dict('records')
        for i in range(len(rows)-1):
            start_stop = rows[i]
            end_stop   = rows[i+1]
            dist_miles = haversine_miles(
                start_stop['Latitude'], start_stop['Longitude'],
                end_stop['Latitude'],  end_stop['Longitude']
            )
            if dist_miles < 20:
                continue  # not a valid trip boundary
            trip_record = {
                'Tractor Ref No': tractor_id,
                'Trip Ref No': f"{tractor_id}-{i+1}",
                'Country': start_stop.get('Country', ''),
                'State': start_stop.get('State', ''),
                'City': start_stop.get('City', ''),
                'Postal Code': start_stop.get('Postal Code', ''),
                'Latitude': start_stop.get('Latitude', None),
                'Longitude': start_stop.get('Longitude', None),
                'To_State': end_stop.get('State', ''),
                'To_City': end_stop.get('City', ''),
                'To_Country': end_stop.get('Country', ''),
                'To_Postal_Code': end_stop.get('Postal Code', ''),
                'To_Latitude': end_stop.get('Latitude', None),
                'To_Longitude': end_stop.get('Longitude', None),
                'Arrival Dt': start_stop['Arrival Datetime'],
                'To_Arrival_Dt': end_stop['Arrival Datetime']
            }
            records.append(trip_record)
    return pd.DataFrame(records)

def merge_trips_with_fuel(knight_trips, knight_fuel):
    """
    Merges trips with assigned fuel transactions (from knight_fuel) using the
    tractor reference number.
    """
    merged = pd.merge(knight_trips, knight_fuel[knight_fuel['assigned'] == True],
                      left_on=['Tractor Ref No'], 
                      right_on=['Equipment Ref No'],
                      how='left',
                      suffixes=['','_fuel'])
    
    # Set fuel columns to NaN if the fuel transaction time falls outside the trip window.
    fuel_columns = ['Date', 'Time',
       'Country_fuel', 'State_fuel', 'City_fuel', 'Fuel Type',
       'Reference Type', 'Equipment Ref No', 'Quantity', 'UOM', 'Unit Price',
       'Total Price', 'Currency Code', 'Voucher/Invoice No', 'Location ID',
       'Location name', 'Latitude_fuel', 'Longitude_fuel', 'Driver Ref No',
       'Address', 'Trip Reference', 'Taxable', 'Location Postal Code',
       'Card/Device Number', 'Odometer_fuel', 'Odometer UOM', 'Fuel Burn Qty',
       'Idle Burn Qty', 'Idle Time', 'Idle Time UOM', 'Burn Qty UOM',
       'Engine Time', 'Engine UOM', 'Current Tank Level', 'Tank Level UOM',
       'Team Driver Ref No', 'EntryMethod', 'Equipment Id', 'Id', 'Comment',
       'Bulk Tank Id', 'Bulk Tank Transaction Id', 'Missing Unit Reference',
       'Missing Driver Reference', 'Faults', 'Dt', 'unit_tank', 'dwell_time', 'verified_location', 'assigned']
    
    merged.loc[
        (merged['Dt'] < merged['Arrival Dt']) | (merged['Dt'] > merged['To_Arrival_Dt']),
        fuel_columns
    ] = np.nan
    
    merged = merged.sort_values(['Tractor Ref No', 'Trip Ref No', 'Arrival Dt', 'Dt'])
    
    # Group by trip-level keys and aggregate fuel transactions into a list
    trips_columns = ['Tractor Ref No', 'Trip Ref No', 'Country', 'State', 'City',
                      'Postal Code', 'Latitude', 'Longitude', 'To_State', 'To_City',
                      'To_Country', 'To_Postal_Code', 'To_Latitude', 'To_Longitude',
                      'Arrival Dt', 'To_Arrival_Dt']
    
    merged = (merged.set_index(trips_columns).groupby(trips_columns, dropna=False)
              .apply(lambda g: g.dropna(how='all').to_dict('records'))
              .reset_index(name='fuel'))
    return merged

def prepare_data(trips, trips_fuel, gps_data, truck):
    """
    For a given truck, merge trips, fuel, and GPS data into a combined record.
    """
    trip_fuel_truck = trips_fuel[trips_fuel['Tractor Ref No'] == truck]
    gps_data_truck = gps_data[gps_data['Equipment Ref No'] == truck]
    trips_truck = trips[trips['Tractor Ref No'] == truck]
    
    trips_gps_truck = pd.merge(trips_truck, gps_data_truck, 
                               left_on=['Tractor Ref No'], 
                               right_on=['Equipment Ref No'],
                               how='left',
                               suffixes=['','_gps'])
    trips_gps_truck.drop(trips_gps_truck.loc[
        (trips_gps_truck['Dt'] < trips_gps_truck['Arrival Dt']) |
        (trips_gps_truck['Dt'] > trips_gps_truck['To_Arrival_Dt'])
    ].index, inplace=True)
    
    req_columns = ['Tractor Ref No', 'Trip Ref No', 'Country', 'State', 'City',
                   'Postal Code', 'Latitude', 'Longitude', 'To_State', 'To_City', 'To_Country',
                   'To_Postal_Code', 'To_Latitude', 'To_Longitude','Arrival Dt', 'To_Arrival_Dt']
    
    trips_gps_truck = trips_gps_truck.sort_values(['Tractor Ref No', 'Trip Ref No', 'Arrival Dt', 'Dt'])
    
    trips_gps_truck = (trips_gps_truck.set_index(req_columns).groupby(req_columns, dropna=False)
                       .apply(lambda g: g.dropna(how='all').to_dict('records'))
                       .reset_index(name='gps'))
    
    trips_fuel_gps_truck = pd.merge(trips_gps_truck, 
                                    trip_fuel_truck[['Tractor Ref No', 'Trip Ref No', 'Arrival Dt','fuel']],
                                    on=['Tractor Ref No', 'Arrival Dt'], 
                                    how='left')
    
    trips_fuel_gps_truck.drop('Trip Ref No_y', axis=1, inplace=True)
    return trips_fuel_gps_truck

def compute_global_truck_average(df):
    """
    Computes a global average 'unit_tank' per truck from the fuel transactions
    contained in the 'fuel' column of the trips DataFrame.
    """
    df = df.copy()
    truck_tank_values = {}
    
    for i, row in df.iterrows():
        truck_id = row['Tractor Ref No']
        fuel_info = row['fuel']
        if not isinstance(fuel_info, list):
            continue
        for item in fuel_info:
            val = item.get('unit_tank', None)
            if val is not None and not np.isnan(val):
                truck_tank_values.setdefault(truck_id, []).append(val)
    
    truck_averages = {truck: (sum(vals) / len(vals)) if vals else np.nan 
                      for truck, vals in truck_tank_values.items()}
    df['unit_tank'] = df['Tractor Ref No'].apply(lambda t: truck_averages.get(t, np.nan))
    return df

# --- Functions for fuel burned and mileage computations ---

def compute_segment_fuel(segment):
    """
    Computes fuel burned in a segment using the average of the first 5 'fuel_prev'
    readings and the last 5 'fuel_curr' readings.
    """
    start_fuel = [g['fuel_prev'] for g in segment[:5] if 'fuel_prev' in g]
    end_fuel = [g['fuel_curr'] for g in segment[-5:] if 'fuel_curr' in g]
    if len(start_fuel) < 5 or len(end_fuel) < 5:
        return 0.0
    start_avg = np.mean(start_fuel)
    end_avg = np.mean(end_fuel)
    return max(start_avg - end_avg, 0)

def calculate_fuel_burned_for_segments(gps_points, segment_types):
    """
    Computes total fuel burned for GPS points belonging to specified segment types.
    """
    total_fuel_burned = 0.0
    current_segment = []
    for g in gps_points:
        if g.get('type') in segment_types:
            current_segment.append(g)
        else:
            if len(current_segment) >= 10:
                total_fuel_burned += compute_segment_fuel(current_segment)
            current_segment = []
    if len(current_segment) >= 10:
        total_fuel_burned += compute_segment_fuel(current_segment)
    return total_fuel_burned

def calculate_fuel_burned_and_mileage(trips_enriched):
    """
    For each trip, segments the GPS drive points into 10-mile segments,
    computes fuel burned per segment, and assigns a mileage (MPG) to each segment.
    Updates each GPS point with 'fuel_burned' and 'mileage'.
    """
    MILE_CONVERSION = 0.000621371  # Meters to miles
    SEGMENT_THRESHOLD = 10  # miles
    for i, row in trips_enriched.iterrows():
        gps_points = row["gps"]
        segment = []
        segment_distance = 0.0
        for gps in gps_points:
            if gps.get("type") != "drive":
                continue
            segment.append(gps)
            segment_distance += gps.get("dist_prev", 0.0) * MILE_CONVERSION
            if segment_distance >= SEGMENT_THRESHOLD or gps is gps_points[-1]:
                valid_fuel = [p["fuel_curr"] for p in segment if p.get("fuel_curr") is not None]
                if len(valid_fuel) < 5:
                    start_fuel = valid_fuel[0] if valid_fuel else None
                    end_fuel = valid_fuel[-1] if valid_fuel else None
                else:
                    start_fuel = np.mean(valid_fuel[:5])
                    end_fuel = np.mean(valid_fuel[-5:])
                if start_fuel is not None and end_fuel is not None and row.get("unit_tank", 0) > 0:
                    fuel_burned_segment = (start_fuel - end_fuel) * row["unit_tank"]
                else:
                    fuel_burned_segment = None
                mileage_segment = (segment_distance / fuel_burned_segment) if fuel_burned_segment and fuel_burned_segment > 0 else 0
                for gps_point in segment:
                    fraction = (gps_point.get("dist_prev", 0.0) * MILE_CONVERSION) / segment_distance if segment_distance > 0 else 0
                    gps_point["fuel_burned"] = fuel_burned_segment * fraction if fuel_burned_segment is not None else None
                    gps_point["mileage"] = mileage_segment
                segment = []
                segment_distance = 0.0
    return trips_enriched

def enrich_trips_with_stops(trips_enriched, stops_df):
    """
    Enhances each trip in trips_enriched with aggregate metrics such as:
      - Distance travelled, time taken, stop counts,
      - Total dwell time, fuel purchased, fuel burned, and MPG.
    """
    trips_enriched = trips_enriched.copy()
    trips_enriched['distance_travelled'] = 0.0
    trips_enriched['time_taken'] = pd.NaT
    trips_enriched['total_stops'] = 0
    trips_enriched['total_fuel_stops'] = 0
    trips_enriched['total_short_stops'] = 0
    trips_enriched['total_long_stops'] = 0
    trips_enriched['total_dwell_time'] = 0.0
    trips_enriched['volume_fuel_purchased'] = 0.0
    trips_enriched['dollar_fuel_purchased'] = 0.0
    trips_enriched['fuel_burned_drive'] = 0.0
    trips_enriched['fuel_burned_idling'] = 0.0
    trips_enriched['fuel_burned_total'] = 0.0
    trips_enriched['mpg'] = 0.0

    stops_grouped = stops_df.groupby('Tractor No')
    def process_trip(row):
        gps_info = row.get('gps', [])
        dist_sum = sum(g.get('dist_prev', 0.0) for g in gps_info if g.get('type') == 'drive')
        fuel_burned_drive = calculate_fuel_burned_for_segments(gps_info, ['drive']) * row.get('unit_tank', 150)
        fuel_burned_idling = calculate_fuel_burned_for_segments(gps_info, ['short', 'long']) * row.get('unit_tank', 150)
        fuel_burned_total = fuel_burned_drive + fuel_burned_idling
        arrival_dt = row['Arrival Dt']
        to_arrival_dt = row['To_Arrival Dt']
        time_diff = to_arrival_dt - arrival_dt if pd.notnull(arrival_dt) and pd.notnull(to_arrival_dt) else pd.NaT
        truck_no = row['Tractor Ref No']
        if (truck_no in stops_grouped.groups) and pd.notnull(arrival_dt) and pd.notnull(to_arrival_dt):
            candidate_stops = stops_grouped.get_group(truck_no)
            mask = (candidate_stops['Arrival Datetime'] >= arrival_dt) & (candidate_stops['Arrival Datetime'] < to_arrival_dt)
            trip_stops = candidate_stops[mask]
        else:
            trip_stops = pd.DataFrame()
        total_stops = len(trip_stops)
        stop_type_series = trip_stops['Stop Type'].fillna('')
        total_fuel_stops = stop_type_series.isin(['fuel', 'fuel ext']).sum()
        total_short_stops = (stop_type_series == 'short').sum()
        total_long_stops = (stop_type_series == 'long').sum()
        dwell_sum = trip_stops['Dwell Time'].fillna(0).sum()
        volume_sum = trip_stops['Quantity'].fillna(0).sum()
        cost_sum = trip_stops['Total Cost'].fillna(0).sum()
        total_miles = dist_sum * 0.000621371
        mpg = total_miles / fuel_burned_total if fuel_burned_total > 0 else None
        return pd.Series({
            'distance_travelled': dist_sum,
            'time_taken': time_diff,
            'total_stops': total_stops,
            'total_fuel_stops': total_fuel_stops,
            'total_short_stops': total_short_stops,
            'total_long_stops': total_long_stops,
            'total_dwell_time': dwell_sum,
            'volume_fuel_purchased': volume_sum,
            'dollar_fuel_purchased': cost_sum,
            'fuel_burned_drive': fuel_burned_drive,
            'fuel_burned_idling': fuel_burned_idling,
            'fuel_burned_total': fuel_burned_total,
            'mpg': mpg
        })
    metrics = trips_enriched.apply(process_trip, axis=1)
    for col in metrics.columns:
        trips_enriched[col] = metrics[col]
    return trips_enriched

def format_trips_data(trips_enriched):
    """
    Final formatting of trips data:
      - Converts datetime columns to strings,
      - Serializes 'gps' and 'fuel' columns as JSON,
      - Converts time durations to seconds.
    """
    trips_enriched['arrival_datetime'] = trips_enriched['Arrival Dt'].apply(lambda x: x.strftime('%Y-%m-%d %H:%M:%S'))
    trips_enriched['to_arrival_datetime'] = trips_enriched['To_Arrival Dt'].apply(lambda x: x.strftime('%Y-%m-%d %H:%M:%S'))
    for i, row in trips_enriched.iterrows():
        for gps in row['gps']:
            if not isinstance(gps['Dt'], str):
                gps['Dt'] = gps['Dt'].strftime('%Y-%m-%d %H:%M:%S')
        for item in row['fuel']:
            if pd.notna(item.get('Dt')):
                item['Dt'] = item['Dt'].strftime('%Y-%m-%d %H:%M:%S')
            else:
                item['Dt'] = ''
    trips_enriched['gps'] = trips_enriched['gps'].apply(lambda x: simplejson.dumps(x, ignore_nan=True))
    trips_enriched['fuel'] = trips_enriched['fuel'].apply(lambda x: simplejson.dumps(x, ignore_nan=True))
    trips_enriched['time_taken'] = trips_enriched['time_taken'].apply(lambda x: x.total_seconds() if pd.notnull(x) else 0)
    return trips_enriched