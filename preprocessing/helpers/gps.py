import glob
import os
import numpy as np
import pandas as pd
from helpers.datetime_utils import convert_to_datetime, calculate_distance, calculate_nxt_distance

def process_zonar_gps(gps_dir):
    """
    Reads and processes the zonar GPS file from the given directory.
    Steps:
      - Reads the first CSV matching "Combined_DRL*"
      - Sets appropriate column names
      - Converts separate Date and Time columns into a datetime column ("Dt")
      - Sorts the DataFrame and computes time differences and positional shifts
      - Computes rolling fuel averages and distance metrics
      - Drops extraneous columns and sets default values for drive type and unit_tank.
    Returns a processed GPS DataFrame.
    """
    # Find the first file matching the pattern
    filename = glob.glob(os.path.join(gps_dir, "Combined_DRL*"))[0]
    gps_df = pd.read_csv(filename, header=None)

    # Set columns from the zonar file
    gps_df.columns = [
        'Equipment Ref No', 'Date', 'Time', 'Latitude', 'Longitude', 'Odometer', 'Odometer UOM', 
        'Heading', 'Engine Status', 'Fuel Burn', 'Fuel Burn UOM', 'Q1', 'Q2', 'Speed', 
        'Tank Level Percent', 'Q3', 'Q4', 'Q5'
    ]

    # Convert to datetime using the helper function
    gps_df = convert_to_datetime(gps_df, 'Date', 'Time', 'Dt')

    # Sort and compute time differences
    gps_df = gps_df.sort_values(['Equipment Ref No', 'Dt'])
    gps_df['time_next'] = gps_df.groupby('Equipment Ref No')['Dt'].diff().shift(-1).dt.total_seconds()
    gps_df['time_prev'] = gps_df.groupby('Equipment Ref No')['Dt'].diff().dt.total_seconds()

    # Compute previous and next positions
    gps_df['lat_prev'] = gps_df.groupby('Equipment Ref No')['Latitude'].shift(1)
    gps_df['long_prev'] = gps_df.groupby('Equipment Ref No')['Longitude'].shift(1)
    gps_df['lat_next'] = gps_df.groupby('Equipment Ref No')['Latitude'].shift(-1)
    gps_df['long_next'] = gps_df.groupby('Equipment Ref No')['Longitude'].shift(-1)

    # Rolling fuel averages
    gps_df['fuel_lag'] = gps_df.groupby('Equipment Ref No')['Tank Level Percent'].shift(1)
    gps_df['fuel_curr'] = gps_df.groupby('Equipment Ref No')['Tank Level Percent']\
                               .rolling(window=5).mean().reset_index(level=0, drop=True)
    gps_df['fuel_prev'] = gps_df.groupby('Equipment Ref No')['fuel_lag']\
                               .rolling(window=5).mean().reset_index(level=0, drop=True)
    gps_df['fuel_curr'] = gps_df['fuel_curr'].fillna(gps_df['Tank Level Percent'])
    gps_df['fuel_prev'] = gps_df['fuel_prev'].fillna(gps_df['fuel_lag'])
    gps_df['fuel_prev'] = gps_df['fuel_prev'].fillna(gps_df['Tank Level Percent'])

    # Calculate distances using helper functions
    gps_df['dist_prev'] = gps_df.apply(calculate_distance, axis=1)
    gps_df['dist_next'] = gps_df.apply(calculate_nxt_distance, axis=1)

    # Set default type and unit_tank
    gps_df['type'] = 'drive'
    gps_df['unit_tank'] = np.nan

    # Compute speed in mph (conversion factor: 2.23694)
    gps_df['speed'] = (gps_df['dist_prev'] / gps_df['time_prev']) * 2.23694

    # Drop unnecessary columns
    gps_df = gps_df.drop(['Date', 'Time', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 
                          'lat_prev', 'long_prev', 'lat_next', 'long_next'], axis=1)

    return gps_df
