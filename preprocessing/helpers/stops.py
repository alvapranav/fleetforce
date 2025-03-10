import numpy as np
import pandas as pd
from datetime import timedelta
from haversine import haversine, Unit
from math import radians, sin, cos, sqrt, atan2

def get_stops(gps, fuel, truck):
    """
    Processes GPS and fuel data for a given truck to extract stop events.
    Returns a list of stops with details such as arrival time, stop location, stop type,
    dwell time, tank levels, and associated fuel transaction details.
    """
    gps_truck = gps[gps['Equipment Ref No'] == truck].copy()
    fuel_truck = fuel[fuel['Equipment Ref No'] == truck].copy()

    if gps_truck.empty:
        print("GPS not available")
        return []

    stops = []
    i = 0
    miles_reset = True

    while i < len(gps_truck):
        if miles_reset:
            meters_traveled = 0
            miles_reset = False

        while i < len(gps_truck) and (gps_truck.iloc[i]['dist_next'] / gps_truck.iloc[i]['time_next'] > 2):
            meters_traveled += 0 if gps_truck.iloc[i]['dist_prev'] is None else gps_truck.iloc[i]['dist_prev']
            i += 1
        if i >= len(gps_truck):
            break

        start_i = i
        arrival_time = gps_truck.iloc[i]['Dt']
        start_tank = gps_truck.iloc[i]['Tank Level Percent']

        while i < len(gps_truck) and (gps_truck.iloc[i]['dist_next'] / gps_truck.iloc[i]['time_next'] <= 2):
            meters_traveled += 0 if gps_truck.iloc[i]['dist_prev'] is None else gps_truck.iloc[i]['dist_prev']
            i += 1

        depart_time = gps_truck.iloc[i - 1]['Dt']
        dwell_time = (depart_time - arrival_time).total_seconds()
        end_tank = gps_truck.iloc[i - 1]['Tank Level Percent']
        stop_lat = gps_truck.iloc[start_i:i]['Latitude'].mean()
        stop_long = gps_truck.iloc[start_i:i]['Longitude'].mean()

        if (end_tank - start_tank) > 0.12:
            gps_truck.loc[gps_truck.index[start_i:i], 'type'] = 'fuel'
            fuel_tx = fuel_truck[
                (fuel_truck['Dt'] > (arrival_time - timedelta(minutes=360))) &
                (fuel_truck['Dt'] < (depart_time + timedelta(minutes=360)))
            ]
            fuel_tx = fuel_tx[fuel_tx['assigned'] == False]

            if not fuel_tx.empty:
                fuel_tx['distance'] = fuel_tx.apply(
                    lambda row: haversine((row['Latitude'], row['Longitude']), (stop_lat, stop_long), unit=Unit.METERS),
                    axis=1
                )
                min_idx = fuel_tx['distance'].idxmin()
                fuel_tx_row = fuel_tx.loc[min_idx]
                old_lat = fuel_tx_row['Latitude']
                old_long = fuel_tx_row['Longitude']
                fuel_truck.loc[min_idx, 'Latitude'] = stop_lat
                fuel_truck.loc[min_idx, 'Longitude'] = stop_long
                fuel_truck.loc[min_idx, 'assigned'] = True
                unit_tank = (fuel_tx_row['Quantity'] / (end_tank - start_tank))
                fuel_truck.loc[min_idx, 'unit_tank'] = unit_tank
                fuel_truck.loc[min_idx, 'dwell_time'] = dwell_time
                gps_truck.loc[gps_truck.index[start_i:i], 'unit_tank'] = unit_tank
                stops.append([
                    arrival_time, stop_lat, stop_long, 'fuel', depart_time, dwell_time,
                    start_tank, end_tank, fuel_tx_row['Location name'], fuel_tx_row['Unit Price'],
                    fuel_tx_row['Total Price'], fuel_tx_row['Quantity'], fuel_tx_row['City'],
                    fuel_tx_row['State'], old_lat, old_long, meters_traveled * 0.000621371
                ])
                miles_reset = True
            else:
                stops.append([
                    arrival_time, stop_lat, stop_long, 'fuel ext', depart_time, dwell_time,
                    start_tank, end_tank, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan,
                    np.nan, np.nan, meters_traveled * 0.000621371
                ])
                miles_reset = True

        elif dwell_time >= 28800:
            gps_truck.loc[gps_truck.index[start_i:i], 'type'] = 'long'
            stops.append([
                arrival_time, stop_lat, stop_long, 'long', depart_time, dwell_time,
                start_tank, end_tank, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan,
                np.nan, np.nan, meters_traveled * 0.000621371
            ])
            miles_reset = True

        elif 300 < dwell_time < 28800:
            gps_truck.loc[gps_truck.index[start_i:i], 'type'] = 'short'
            stops.append([
                arrival_time, stop_lat, stop_long, 'short', depart_time, dwell_time,
                start_tank, end_tank, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan,
                np.nan, np.nan, meters_traveled * 0.000621371
            ])
            miles_reset = True

        i += 1

    gps.loc[gps_truck.index, ['type', 'unit_tank']] = gps_truck[['type', 'unit_tank']]
    fuel.loc[fuel_truck.index, ['Latitude', 'Longitude', 'unit_tank', 'dwell_time', 'assigned']] = \
        fuel_truck[['Latitude', 'Longitude', 'unit_tank', 'dwell_time', 'assigned']]
    
    return stops

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Returns the distance in meters between two lat/lon points using the haversine formula.
    """
    R = 6371e3  # Earth radius in meters
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = (sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2)
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c

def cluster_stops(data, distance_threshold=400, time_threshold=timedelta(hours=0.5)):
    """
    Clusters consecutive (immediately next) non-fuel stops if:
      1) They are within 'distance_threshold' meters of each other,
      2) The time gap between one stop's departure and the next stop's arrival is <= 'time_threshold',
      3) No fuel stops exist between those two stops in that time window.
    
    Only consecutive stops (i.e., index i and i+1 in the sorted-by-time DataFrame) are merged.
    Returns a new DataFrame with aggregated stops combined with any fuel stops.
    """
    def process_truck_stops(truck_stops):
        non_fuel_stops = truck_stops[~truck_stops['Stop Type'].str.contains('fuel', case=False)].copy()
        fuel_stops = truck_stops[truck_stops['Stop Type'].str.contains('fuel', case=False)].copy()
        non_fuel_stops.sort_values(by='Arrival Datetime', inplace=True)
        non_fuel_stops.reset_index(drop=True, inplace=True)
        visited = set()
        clusters = []
        i = 0
        while i < len(non_fuel_stops):
            if i in visited:
                i += 1
                continue
            cluster_indices = [i]
            visited.add(i)
            while True:
                if cluster_indices[-1] >= len(non_fuel_stops) - 1:
                    break
                current_idx = cluster_indices[-1]
                next_idx = current_idx + 1
                if next_idx in visited:
                    break
                current_stop = non_fuel_stops.iloc[current_idx]
                next_stop = non_fuel_stops.iloc[next_idx]
                dist = haversine_distance(current_stop['Latitude'], current_stop['Longitude'],
                                          next_stop['Latitude'], next_stop['Longitude'])
                if dist > distance_threshold:
                    break
                time_gap = next_stop['Arrival Datetime'] - current_stop['Departure Datetime']
                if time_gap < timedelta(0) or time_gap > time_threshold:
                    break
                in_between_fuel = fuel_stops[
                    (fuel_stops['Arrival Datetime'] >= current_stop['Departure Datetime']) &
                    (fuel_stops['Departure Datetime'] <= next_stop['Arrival Datetime'])
                ]
                if not in_between_fuel.empty:
                    break
                cluster_indices.append(next_idx)
                visited.add(next_idx)
            clusters.append(cluster_indices)
            i += 1

        aggregated_stops = []
        for cluster in clusters:
            cluster_df = non_fuel_stops.iloc[cluster]
            arrival_min = cluster_df['Arrival Datetime'].min()
            departure_max = cluster_df['Departure Datetime'].max()
            dwell_seconds = (departure_max - arrival_min).total_seconds()
            sum_dwell = cluster_df['Dwell Time'].sum()
            dwell_type = 'short'
            if sum_dwell > 300 and sum_dwell <= 28800:
                dwell_type = 'short'
            elif sum_dwell > 28800:
                dwell_type = 'long'
            truck_id = cluster_df['Tractor No'].iloc[0]
            aggregated_stop = {
                'Tractor No': truck_id,
                'Latitude': cluster_df['Latitude'].mean(),
                'Longitude': cluster_df['Longitude'].mean(),
                'Arrival Datetime': arrival_min,
                'Departure Datetime': departure_max,
                'Miles Travelled': cluster_df['Miles Travelled'].sum(),
                'Dwell Time': dwell_seconds,
                'Stop Type': dwell_type,
                'Fuel Tank Percent Before': cluster_df['Fuel Tank Percent Before'].iloc[0],
                'Fuel Tank Percent After': cluster_df['Fuel Tank Percent After'].iloc[-1]
            }
            aggregated_stops.append(aggregated_stop)
        aggregated_stops_df = pd.DataFrame(aggregated_stops)
        combined_df = pd.concat([aggregated_stops_df, fuel_stops], ignore_index=True)
        combined_df.sort_values(by='Arrival Datetime', inplace=True)
        return combined_df

    results = []
    for tractor_no, truck_stops in data.groupby('Tractor No'):
        result_df = process_truck_stops(truck_stops)
        results.append(result_df)
    return pd.concat(results, ignore_index=True)

def update_knight_gps_with_stops(knight_gps, stops_df):
    """
    Update knight_gps records by matching each record's 'Dt' to a stop in stops_df where:
      Arrival Datetime <= Dt < Departure Datetime,
    per truck.
    Returns an updated knight_gps DataFrame.
    """
    updated_gps = knight_gps.copy()
    truck_ids = stops_df['Tractor No'].unique()
    for truck in truck_ids:
        stops_truck = stops_df[stops_df['Tractor No'] == truck]
        gps_truck = updated_gps[updated_gps['Equipment Ref No'] == truck]
        if gps_truck.empty:
            continue
        intervals = pd.IntervalIndex.from_arrays(
            stops_truck['Arrival Datetime'],
            stops_truck['Departure Datetime'],
            closed='left'
        )
        indices, _ = intervals.get_indexer_non_unique(gps_truck['Dt'])
        valid = indices != -1
        updated_gps.loc[gps_truck.index[valid], 'type'] = stops_truck.iloc[indices[valid]]['Stop Type'].values
    return updated_gps
