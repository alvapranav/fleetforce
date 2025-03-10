import time
import datetime
import requests
import pandas as pd

# API Endpoints
ELEVATION_URL = "https://api.open-elevation.com/api/v1/lookup"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# Rate limiting settings
MAX_CALLS_BEFORE_SLEEP = 50
SLEEP_DURATION_SECONDS = 2

# Caches to avoid duplicate API calls
_elevation_cache = {}
_weather_cache = {}
_api_call_count = 0

def get_elevation(lat, lon):
    """
    Retrieve elevation (in meters) from the Open-Elevation API.
    Uses caching to reduce repeated API calls.
    """
    global _api_call_count
    key = (round(lat, 5), round(lon, 5))
    if key in _elevation_cache:
        return _elevation_cache[key]

    _api_call_count += 1
    if _api_call_count % MAX_CALLS_BEFORE_SLEEP == 0:
        time.sleep(SLEEP_DURATION_SECONDS)

    try:
        resp = requests.get(ELEVATION_URL, params={"locations": f"{key[0]},{key[1]}"}, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        elevation = data["results"][0]["elevation"]
        _elevation_cache[key] = elevation
        return elevation
    except Exception as e:
        print(f"Elevation API error for {lat},{lon}: {e}")
        return None

def fetch_weather_for_day(lat, lon, dt_obj):
    """
    Retrieves hourly weather data for a single day at the given lat/lon.
    Caches the result to avoid redundant API calls.
    """
    global _api_call_count
    lat_r = round(lat, 5)
    lon_r = round(lon, 5)
    date_only = dt_obj.date()  # e.g., 2023-03-04

    cache_key = (lat_r, lon_r, date_only)
    if cache_key in _weather_cache:
        return _weather_cache[cache_key]

    _api_call_count += 1
    if _api_call_count % MAX_CALLS_BEFORE_SLEEP == 0:
        time.sleep(SLEEP_DURATION_SECONDS)

    params = {
        "latitude": lat_r,
        "longitude": lon_r,
        "start_date": str(date_only),
        "end_date": str(date_only),
        "hourly": "temperature_2m,apparent_temperature,precipitation,snowfall,weathercode,windspeed_10m",
        "timezone": "UTC",
    }

    try:
        resp = requests.get(OPEN_METEO_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        hourly_data = []
        if "hourly" in data:
            hours = data["hourly"].get("time", [])
            for i, time_str in enumerate(hours):
                hourly_data.append({
                    "time": time_str,
                    "temperature_2m": data["hourly"].get("temperature_2m", [None])[i],
                    "apparent_temperature": data["hourly"].get("apparent_temperature", [None])[i],
                    "precipitation": data["hourly"].get("precipitation", [None])[i],
                    "snowfall": data["hourly"].get("snowfall", [None])[i],
                    "weathercode": data["hourly"].get("weathercode", [None])[i],
                    "windspeed_10m": data["hourly"].get("windspeed_10m", [None])[i],
                })
        _weather_cache[cache_key] = hourly_data
        return hourly_data

    except Exception as e:
        print(f"Open-Meteo API error for {lat},{lon} on {dt_obj}: {e}")
        return []

def get_weather_for_timestamp(lat, lon, dt_obj):
    """
    Returns the weather data record (from hourly data) that is closest in time to dt_obj.
    """
    hourly_data = fetch_weather_for_day(lat, lon, dt_obj)
    if not hourly_data:
        return {}

    target_dt = dt_obj.replace(tzinfo=None)  # Make naive for comparison
    best_record = None
    min_diff = float("inf")
    for record in hourly_data:
        record_dt = datetime.datetime.fromisoformat(record["time"])
        diff = abs((record_dt - target_dt).total_seconds())
        if diff < min_diff:
            min_diff = diff
            best_record = record

    return best_record if best_record else {}

def enrich_knight_gps(gps_df):
    """
    Enriches the GPS DataFrame by adding elevation and weather data.
    New columns include:
      - Elevation, Temperature, ApparentTemp, Precipitation,
        Snowfall, WeatherCode, WindSpeed.
    """
    df = gps_df.copy()
    new_cols = ["Elevation", "Temperature", "ApparentTemp", "Precipitation", "Snowfall", "WeatherCode", "WindSpeed"]
    for col in new_cols:
        df[col] = None

    for idx, row in df.iterrows():
        lat = row["Latitude"]
        lon = row["Longitude"]
        dt_obj = row["Dt"]

        elev = get_elevation(lat, lon)
        weather = get_weather_for_timestamp(lat, lon, dt_obj)

        df.at[idx, "Elevation"] = elev
        df.at[idx, "Temperature"] = weather.get("temperature_2m")
        df.at[idx, "ApparentTemp"] = weather.get("apparent_temperature")
        df.at[idx, "Precipitation"] = weather.get("precipitation")
        df.at[idx, "Snowfall"] = weather.get("snowfall")
        df.at[idx, "WeatherCode"] = weather.get("weathercode")
        df.at[idx, "WindSpeed"] = weather.get("windspeed_10m")

    return df
