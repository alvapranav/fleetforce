import pandas as pd
import pytz
from math import radians, sin, cos, sqrt, atan2

def convert_to_datetime(df, date_field, time_field, new_date_time):
    """
    Converts date and time fields in a DataFrame into a single datetime column.
    """
    df[new_date_time] = pd.to_datetime(df[date_field].astype(str), format='%Y%m%d')
    df[new_date_time] += pd.to_timedelta(df[time_field] // 10000, unit='h')
    df[new_date_time] += pd.to_timedelta((df[time_field] // 100) % 100, unit='m')
    df[new_date_time] += pd.to_timedelta(df[time_field] % 100, unit='s')
    df[new_date_time] = df[new_date_time].apply(lambda x: pytz.timezone('UTC').localize(x))
    return df

def calculate_distance(row):
    """
    Calculate distance between the current point and the previous point.
    """
    from haversine import haversine, Unit
    if row.name == 0:
        return None
    return haversine((row['Latitude'], row['Longitude']),
                     (row['lat_prev'], row['long_prev']),
                     unit=Unit.METERS)

def calculate_nxt_distance(row):
    """
    Calculate distance between the current point and the next point.
    """
    from haversine import haversine, Unit
    if row.name == 0:
        return None
    return haversine((row['Latitude'], row['Longitude']),
                     (row['lat_next'], row['long_next']),
                     unit=Unit.METERS)

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Returns the distance in meters between two lat/long points using the haversine formula.
    """
    R = 6371e3  # radius of Earth in meters
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = (sin(dlat/2)**2
         + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2)
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c
