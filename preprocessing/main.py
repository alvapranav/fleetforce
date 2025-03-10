import pandas as pd
import numpy as np
from db.database import create_db_engine, load_places
from helpers.places import build_kdtree, check_places
from helpers.datetime_utils import convert_to_datetime, calculate_distance, calculate_nxt_distance
from helpers.stops import get_stops, cluster_stops, update_knight_gps_with_stops
from helpers.gps import process_zonar_gps
from helpers.weather import enrich_knight_gps
from helpers.fuel import process_fuel_data, match_small_fuel_transactions, normalize_fuel_locations
from helpers.trips import (
    filter_long_stops,
    enrich_long_stops_with_location,
    build_trip_records,
    merge_trips_with_fuel,
    prepare_data,
    compute_global_truck_average,
    calculate_fuel_burned_and_mileage,
    enrich_trips_with_stops,
    format_trips_data
)

def main():
    # Set display options and disable chained assignment warnings
    pd.set_option('display.max_columns', None)
    pd.set_option('display.max_rows', None)
    pd.options.mode.chained_assignment = None

    # === Database and Places Processing ===
    engine = create_db_engine()
    places_df = load_places(engine)
    kdtree = build_kdtree(places_df)
    
    # (Optional) Debug: Check nearby places for a given coordinate
    check_result = check_places(40.7128, -74.0060, places_df, kdtree)
    print("Nearby Places:", check_result)
    
    # === Process GPS Data ===
    gps_dir = 'gps/'  # Directory containing zonar GPS files
    knight_gps = process_zonar_gps(gps_dir)
    knight_gps = enrich_knight_gps(knight_gps)
    
    # === Process Fuel Data ===
    fuel_filepath = './fuel-dispatch-knight-july-24/Fuel_Report-knight-july-24.csv'
    knight_fuel = process_fuel_data(fuel_filepath)
    knight_fuel = normalize_fuel_locations(knight_fuel)
    
    # === Compute Stops per Truck ===
    all_trucks = knight_gps['Equipment Ref No'].unique()
    stops_result = []
    for truck in all_trucks:
        print("Processing stops for truck:", truck)
        stops = get_stops(knight_gps, knight_fuel, truck)
        # Append truck ID to each stop record (the stop function returns a list)
        for stop in stops:
            stop.append(truck)
        if stops:
            stops_result.extend(stops)
    
    # Define stops DataFrame columns (order matters)
    stops_columns = [
        'Arrival Datetime', 'Latitude', 'Longitude', 'Stop Type', 'Departure Datetime', 'Dwell Time',
        'Fuel Tank Percent Before', 'Fuel Tank Percent After','Fuel Location Name', 'Unit Price',
        'Total Cost', 'Quantity','City','State', 'Fuel Latitude', 'Fuel Longitude', 'Miles Travelled',
        'Tractor No'
    ]
    stops_df = pd.DataFrame(stops_result, columns=stops_columns)
    # Reorder columns as desired
    stops_df = stops_df[['Tractor No', 'Stop Type', 'Latitude', 'Longitude', 'Arrival Datetime',
                         'Departure Datetime', 'Miles Travelled', 'Dwell Time', 'Fuel Latitude',
                         'Fuel Longitude', 'Fuel Tank Percent Before','Fuel Tank Percent After',
                         'Fuel Location Name', 'Unit Price', 'Total Cost', 'Quantity', 'City', 'State']]
    
    # Match small fuel transactions to stops for each truck
    for truck in all_trucks:
        print("Matching fuel transactions for truck:", truck)
        stops_df, knight_fuel = match_small_fuel_transactions(stops_df, knight_fuel, truck)
    
    print("Stop Type counts after fuel matching:")
    print(stops_df['Stop Type'].value_counts())
    
    # Update GPS data with stop types based on time intervals
    knight_gps = update_knight_gps_with_stops(knight_gps, stops_df)
    print("GPS type counts after updating with stops:")
    print(knight_gps['type'].value_counts())
    
    # === Trips (Dispatch) Processing ===
    # 1. Filter long stops and enrich them with geocoded location details
    df_long = filter_long_stops(stops_df)
    df_long = enrich_long_stops_with_location(df_long)
    
    # 2. Build trip records from long stops and merge with fuel data
    knight_trips = build_trip_records(df_long)
    knight_trips_fuel = merge_trips_with_fuel(knight_trips, knight_fuel)
    
    # 3. For each truck, merge trips, fuel, and GPS data into enriched trip records
    trips_enriched = pd.DataFrame()
    for truck in all_trucks:
        try:
            truck_trips = prepare_data(knight_trips, knight_trips_fuel, knight_gps, truck)
            print("Prepared trips for truck:", truck)
        except Exception as e:
            print("Error processing truck", truck, e)
            continue
        truck_trips = truck_trips.sort_values(['Arrival Dt'])
        trips_enriched = pd.concat([trips_enriched, truck_trips], ignore_index=True)
    
    # 4. Compute per-truck global fuel conversion averages and further enrich trip metrics
    trips_enriched = compute_global_truck_average(trips_enriched)
    trips_enriched = calculate_fuel_burned_and_mileage(trips_enriched)
    trips_enriched = enrich_trips_with_stops(trips_enriched, stops_df)
    trips_enriched = format_trips_data(trips_enriched)
    
    # Final output: Print a sample of the enriched trips DataFrame
    print("Final enriched trips:")
    print(trips_enriched.head())

if __name__ == "__main__":
    main()