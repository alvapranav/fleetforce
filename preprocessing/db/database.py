from sqlalchemy import create_engine
import pandas as pd

def create_db_engine():
    """
    Create and return a PostgreSQL database engine.
    """
    engine = create_engine('postgresql://newuser:password@localhost:5432/fleet')
    return engine

def load_places(engine):
    """
    Load the places data from the database and return a DataFrame
    with only the necessary columns.
    """
    query = """
        SELECT *
        FROM places
        WHERE
            highway  = 'rest_area' OR
            amenity IN ('parking', 'fuel', 'restaurant', 'fast_food') OR
            building IN ('commercial', 'industrial', 'warehouse', 'retail', 'hotel') OR
            shop IN ('car_parts', 'car_repair', 'truck', 'tyres', 'car', 'trailer', 'fuel', 
                     'wholesale', 'department_store', 'general', 'mall', 'supermarket', 'convenience')
            AND (highway IS NOT NULL OR
                 amenity IS NOT NULL OR
                 building IS NOT NULL OR
                 shop IS NOT NULL)
    """
    places_df = pd.read_sql_query(query, engine)
    # Keep only the required columns
    places_df = places_df[['hash_index', 'name', 'geometry', 'amenity', 'building', 'shop', 'highway', 'latitude', 'longitude']]
    return places_df
