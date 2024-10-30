from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from .database import async_session
from .models import Stops, Trips, Places

app = FastAPI()

async def get_db():
    async with async_session() as session:
        yield session

@app.get("api/stops/{trip_id}/{arrival_datetime}")
async def get_stops(trip_id: str, arrival_datetime: str,db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        db.query("SELECT * FROM stops WHERE trip_id = :trip_id AND arrival_datetime = :arrival_datetime", 
                 {"trip_id": trip_id, "arrival_datetime": arrival_datetime})
    )
    stops = result.fetchall()
    if stops:
        return dict(stops)
    else:
        raise HTTPException(status_code=404, detail="Stops not found")
    
@app.get("api/trips/{trip_id}/{arrival_datetime}")
async def get_trip(trip_id: str, arrival_datetime: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        db.query("SELECT * FROM trips WHERE trip_id = :trip_id  AND arrival_datetime = :arrival_datetime", 
                 {"trip_id": trip_id, "arrival_datetime": arrival_datetime})
    )
    trip = result.fetchone()
    if trip:
        return dict(trip)
    else:
        raise HTTPException(status_code=404, detail="Trip not found")
    

