from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import text
from .database import async_session
from .models import Stops, Trips, Places

app = FastAPI()

async def get_db():
    async with async_session() as session:
        yield session

@app.get("/api/stops/{tractor_id}/{arrival_datetime}/{to_arrival_datetime}")
async def get_stops(tractor_id: str, arrival_datetime: str, to_arrival_datetime: str, db: AsyncSession = Depends(get_db)):
    result1 = await db.execute(text("""SELECT * FROM stops WHERE tractor_id = :tractor_id AND arrival_datetime >= :arrival_datetime AND arrival_datetime < :to_arrival_datetime
                                    ORDER BY arrival_datetime"""), 
                 {"tractor_id": tractor_id, "arrival_datetime": arrival_datetime, "to_arrival_datetime": to_arrival_datetime})
    stops = result1.fetchall()
    if stops:
        return [row._asdict() for row in stops]
    else:
        raise HTTPException(status_code=404, detail="Stops not found")
    
@app.get("/api/tractor_trips/{tractorId}")
async def get_tractor_trips(tractorId: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM trips WHERE tractor_id = :tractor_id"), 
                 {"tractor_id": tractorId})
    trips = result.fetchall()
    if trips:
        return [row._asdict() for row in trips]
    else:
        raise HTTPException(status_code=404, detail="Trips not found")
    
@app.get("/api/trip/{tractor_id}/{arrival_datetime}")
async def get_trip(tractor_id: str, arrival_datetime: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM trips WHERE tractor_id = :tractor_id  AND arrival_datetime = :arrival_datetime"), 
                 {"tractor_id": tractor_id, "arrival_datetime": arrival_datetime})
    trip = result.fetchall()
    if trip:
        return [row._asdict() for row in trip]
    else:
        raise HTTPException(status_code=404, detail="Trip not found")
    
@app.get("/api/trips")
async def get_trips_in_stops(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""SELECT tractor_id, trip_id, country, state, city, to_country, to_state, to_city, arrival_datetime,
                                    to_arrival_datetime, distance_travelled, time_taken, total_stops, total_fuel_stops, total_short_stops,
                                    total_long_stops, total_dwell_time, volume_fuel_purchased, dollar_fuel_purchased, fuel_burned_drive, 
                                    fuel_burned_idling, fuel_burned_total, mpg, unit_tank FROM trips"""))
    trip = result.fetchall()
    if trip:
        return [row._asdict() for row in trip]
    else:
        raise HTTPException(status_code=404, detail="Trip not found")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
    
def build_linestring_wkt(routePoints):
    """
    routePoints is a list of {lat: float, long: float} or similar.
    Returns 'LINESTRING(lon lat, lon lat, ...)' in WKT.
    """
    if not routePoints:
        return None
    coords_list = []
    for pt in routePoints:
        lon = pt["long"]
        lat = pt["lat"]
        coords_list.append(f"{lon} {lat}")
    coords_str = ", ".join(coords_list)
    return f"LINESTRING({coords_str})"

# End of helper

from pydantic import BaseModel
from typing import List, Optional

class FuelStopsRequest(BaseModel):
    subRoute: List[dict]  # e.g. [{lat, long, dist, ...}, ...]

class RestStopsRequest(BaseModel):
    routeSegment: List[dict]

@app.post("/api/findFuelStops")
async def find_fuel_stops(req: FuelStopsRequest, db: AsyncSession = Depends(get_db)):
    """
    Takes a subRoute array of lat/long points for the partial route.
    Builds a corridor using e.g. 1 mile buffer.
    Finds all rows in 'fuel' that intersect that corridor,
    groups by location_id, returning min(unit_price) and trafficCount.
    """
    if not req.subRoute:
        return []

    corridor_dist_meters = 3218.69  # 2 mile in meters
    linestring = build_linestring_wkt(req.subRoute)

    if not linestring:
        return []

    query = text("""
        WITH routegeom AS (
          SELECT ST_Buffer(
            ST_GeomFromText(:linestring, 4326)::geography,
            :dist
          )::geometry AS corridor
        ),
        fpts AS (
          SELECT *,
                 ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) as ptgeom
          FROM fuel
          WHERE longitude IS NOT NULL AND latitude IS NOT NULL
        )
        SELECT
          location_id,
          location_name,
          MIN(unit_price) as unit_price,
          COUNT(*) as traffic_count,
          AVG(longitude) as longitude,
          AVG(latitude) as latitude
        FROM fpts, routegeom
        WHERE ST_Intersects(ptgeom, corridor)
        GROUP BY location_id, location_name
    """)

    result = await db.execute(query, {
        "linestring": linestring,
        "dist": corridor_dist_meters
    })
    rows = result.fetchall()
    if rows:
        return [row._asdict() for row in rows]
    else:
        raise HTTPException(status_code=404, detail="Fuel Stops not found")

@app.post("/api/findRestStops")
async def find_rest_stops(req: RestStopsRequest, db: AsyncSession = Depends(get_db)):
    """
    Takes a routeSegment array of lat/long points for the partial route.
    Builds corridor, finds 'places' with highway='rest_area' that intersects.
    """
    if not req.routeSegment:
        return []

    corridor_dist_meters = 3218.69  # 2 mile in meters
    linestring = build_linestring_wkt(req.routeSegment)

    if not linestring:
        return []

    query = text("""
        WITH routegeom AS (
          SELECT ST_Buffer(
            ST_GeomFromText(:linestring, 4326)::geography,
            :dist
          )::geometry AS corridor
        )
        SELECT
          hash_index,
          name,
          amenity,
          highway,
          ST_X(coords::geometry) as longitude,
          ST_Y(coords::geometry) as latitude
        FROM places, routegeom
        WHERE highway='rest_area'
          AND ST_Intersects(coords::geometry, corridor)
    """)

    result = await db.execute(query, {
        "linestring": linestring,
        "dist": corridor_dist_meters
    })
    rows = result.fetchall()
    if rows:
        return [row._asdict() for row in rows]
    else:
        raise HTTPException(status_code=404, detail="Fuel Stops not found")
