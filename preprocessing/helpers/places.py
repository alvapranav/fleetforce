import numpy as np
import pandas as pd
from haversine import haversine, Unit
from scipy.spatial import KDTree

def build_kdtree(places_df):
    """
    Build and return a KDTree from the latitude and longitude values of the places DataFrame.
    """
    coordinates = places_df[['latitude', 'longitude']].apply(lambda x: (x['latitude'], x['longitude']), axis=1).tolist()
    tree = KDTree(coordinates)
    return tree

def check_places(lat, lon, places_df, kdtree):
    """
    Find nearby points of interest (POI) within a 0.002 radius.
    Returns a dictionary with:
      - stop_type: one of 'rest', 'food', or 'warehouse'
      - primary: details for the closest place
      - secondary: a list of details for up to 9 additional nearby places.
    """
    indices = kdtree.query_ball_point((lat, lon), 0.002)
    poi = places_df.iloc[indices, :].copy()
    
    poi['distance'] = poi[['latitude', 'longitude']].apply(
        lambda x: haversine((lat, lon), (x['latitude'], x['longitude']), unit=Unit.METERS),
        axis=1
    )
    
    closest = poi.groupby(['name', 'geometry', 'amenity', 'building', 'shop', 'highway'], dropna=False)['distance']\
                 .min().reset_index().sort_values(by='distance').head(10)
    
    cols_to_use = ['geometry', 'distance']
    get_coords = pd.merge(poi, closest[cols_to_use], on=['geometry', 'distance'], how='right').drop('hash_index', axis=1)
    
    if get_coords.shape[0] < 10:
        for i in range(get_coords.shape[0], 10):
            get_coords.loc[i] = [np.nan] * len(get_coords.columns)
    
    features = []
    for _, row in get_coords.iterrows():
        features.append({
            'name': row['name'],
            'amenity': row['amenity'],
            'building': row['building'],
            'shop': row['shop'],
            'highway': row['highway'],
            'latitude': row['latitude'],
            'longitude': row['longitude'],
            'geometry': row['geometry']
        })
    
    tags = []
    for field in ['amenity', 'building', 'shop', 'highway']:
        tags.extend(closest[field].unique().tolist())
    
    if 'rest_area' in tags:
        stop_type = 'rest'
    elif 'fast_food' in tags:
        stop_type = 'food'
    else:
        stop_type = 'warehouse'
    
    return {
        'stop_type': stop_type,
        'primary': features[0],
        'secondary': features[1:10]
    }

def get_nearest_places_details(lat, lon, places_df, kdtree):
    """
    Returns a flattened dictionary of nearest place details.
    The first key, 'is_warehouse', is set to the stop type.
    For up to 10 nearest stops, returns keys:
      nearest{i}_name, nearest{i}_amenity, nearest{i}_building,
      nearest{i}_shop, nearest{i}_highway, nearest{i}_latitude,
      nearest{i}_longitude, nearest{i}_geometry.
    If fewer than 10 stops are found, missing fields are set to np.nan.
    """
    result = check_places(lat, lon, places_df, kdtree)
    details = {}
    details['is_warehouse'] = result['stop_type']
    # Primary stop becomes nearest1, and subsequent stops are nearest2 ... nearest10
    stops = [result['primary']] + result['secondary']
    for i in range(1, 11):
        if i-1 < len(stops):
            stop = stops[i-1]
            details[f'nearest{i}_name'] = stop.get('name', np.nan)
            details[f'nearest{i}_amenity'] = stop.get('amenity', np.nan)
            details[f'nearest{i}_building'] = stop.get('building', np.nan)
            details[f'nearest{i}_shop'] = stop.get('shop', np.nan)
            details[f'nearest{i}_highway'] = stop.get('highway', np.nan)
            details[f'nearest{i}_latitude'] = stop.get('latitude', np.nan)
            details[f'nearest{i}_longitude'] = stop.get('longitude', np.nan)
            details[f'nearest{i}_geometry'] = stop.get('geometry', np.nan)
        else:
            details[f'nearest{i}_name'] = np.nan
            details[f'nearest{i}_amenity'] = np.nan
            details[f'nearest{i}_building'] = np.nan
            details[f'nearest{i}_shop'] = np.nan
            details[f'nearest{i}_highway'] = np.nan
            details[f'nearest{i}_latitude'] = np.nan
            details[f'nearest{i}_longitude'] = np.nan
            details[f'nearest{i}_geometry'] = np.nan
    return details
