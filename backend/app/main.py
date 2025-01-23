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
    result1 = await db.execute(text("SELECT * FROM stops WHERE tractor_id = :tractor_id AND arrival_datetime >= :arrival_datetime AND arrival_datetime < :to_arrival_datetime"), 
                 {"tractor_id": tractor_id, "arrival_datetime": arrival_datetime, "to_arrival_datetime": to_arrival_datetime})
    stops = result1.fetchall()
    if stops:
        return [row._asdict() for row in stops]
    else:
        raise HTTPException(status_code=404, detail="Stops not found")
    
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
    result = await db.execute(text("""SELECT tractor_id, trip_ref_norm, country, state, city, to_country, to_state, to_city, arrival_datetime,
                                    to_arrival_datetime, distance_travelled, time_taken, total_stops, total_fuel_stops, total_short_stops,
                                    total_long_stops, total_dwell_time, volume_fuel_purchased, dollar_fuel_purchased FROM trips"""))
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
    

