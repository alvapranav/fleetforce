import React, { useEffect, useState, useRef } from 'react'
// import { Box, Grid2, Typography } from '@mui/material'
import maplibregl from 'maplibre-gl'
import axios from 'axios'
import { ViewMetric, ViewRoute, PlaybackControls, MapControls } from '../../components'
import './ExploreRoute.css'


const ExploreRoute = ({ tripId, arrivalDate }) => {
    const mapContainerRef = useRef(null)
    const map = useRef(null)
    const [mapInstance, setMapInstance] = useState(null)
    const [trips, setTrips] = useState(null);
    const [stops, setStops] = useState([]);
    const [toArrivalDate, setToArrivalDate] = useState('')
    const [loadingtrips, setLoadingTrips] = useState(true)
    const [loadingstops, setLoadingStops] = useState(true)
    const [routeGeoJson, setRouteGeoJson] = useState(null)
    const [processedGPSData, setProcessedGPSData] = useState([])
    const [totalDrivePoints, setTotalDrivePoints] = useState(0)
    const [stopIndices, setStopIndices] = useState([])
    const [currentPosition, setCurrentPosition] = useState(0)
    const [mapStyle, setMapStyle] = useState('https://api.maptiler.com/maps/basic-v2/style.json?key=oGOTJkyBZPxrLa145LN6')
    const [examineStop, setExamineStop] = useState(false)
    const [truckMarker, setTruckMarker] = useState(null)

    useEffect(() => {
        if (map.current) return;

        map.current = new maplibregl.Map({
            container: mapContainerRef.current,
            style: "https://api.maptiler.com/maps/basic-v2/style.json?key=oGOTJkyBZPxrLa145LN6",
            center: [0, 0],
            zoom: 2,
        });

        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

        setMapInstance(map.current);
    }, []);

    useEffect(() => {
        if (!mapInstance) return

        const fetchTripsData = async () => {
            try {
                setLoadingTrips(true)

                const response = await axios.get(`/api/trips/${tripId}/${arrivalDate}`)
                const tripsData = response.data

                setTrips(tripsData[0])

                setLoadingTrips(false)

            }
            catch (error) {
                console.error('Error fetching trips data:', error)
                setLoadingTrips(false)
            }
        }

        fetchTripsData()

    }, [mapInstance, tripId, arrivalDate]);

    useEffect(() => {
        if (!mapInstance) return
        const fetchStopsData = async () => {
            try {

                setLoadingStops(true)

                const endDate = trips.to_arrival_datetime
                setToArrivalDate(endDate);

                const response = await axios.get(`/api/stops/${tripId}/${arrivalDate}/${toArrivalDate}`)
                const stopsData = response.data
                setStops(stopsData)

                setLoadingStops(false)

            }
            catch (error) {
                console.error('Error fetching stops data:', error)
                setLoadingStops(false)
            }
        }

        fetchStopsData()

    }, [mapInstance, tripId, arrivalDate, trips, loadingtrips, toArrivalDate]);

    useEffect(() => {
        // if (!mapInstance || loadingstops) return;

        if (!loadingstops && stops.length > 0) {

            // if (currentPosition === 0) {

            var gpsData = trips.gps
            gpsData = JSON.parse(gpsData)

            const processedData = processGPSData({ gpsData, stops })
            setProcessedGPSData(processedData.processedGPSData)
            setStopIndices(processedData.stopIndices)
            setTotalDrivePoints(processedData.processedGPSData.length)

            // Add route layer
            setRouteGeoJson({
                type: 'FeatureCollection',
                features: gpsData.map((point) => ({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [point.Longitude_gps, point.Latitude_gps],
                    },
                    properties: {
                        timestamp: point.Dt,
                        speed: point.speed,
                        mileage: point.mileage,
                    },
                })),
            })
        }
    }, [trips, stops, loadingstops]);

    const processGPSData = ({ gpsData, stops }) => {
        const processedGPSData = [];
        const stopIndices = [];

        let cumulativeDistance = 0

        gpsData.map((point) => {
            if (point.type === 'drive') {
                processedGPSData.push({
                    lat: point.Latitude_gps,
                    long: point.Longitude_gps,
                    time: point.Dt,
                    fuel: point['Tank Level Percent'],
                    dist: point.dist_prev
                })
            } else {
                const stop = stops.find((stop) => stop.departure_datetime === point.Dt)
                cumulativeDistance += point.dist_prev

                if (stop) {
                    const stopPoint = {
                        lat: stop.latitude,
                        long: stop.longitude,
                        time: point.Dt,
                        fuel: stop.fuel_tank_percent_after,
                        dist: cumulativeDistance
                    }
                    cumulativeDistance = 0

                    stopIndices.push(processedGPSData.length)
                    processedGPSData.push(stopPoint)

                }
            }
        })

        return { processedGPSData, stopIndices }

    }

    const handlePositionChange = (position) => {
        setCurrentPosition(position)
    }

    const handleChangeMapStyle = (style) => {
        setMapStyle(style)
        mapInstance.setStyle(style)
    }

    const handleToggleHeatMap = () => {
    }

    const handleExamineStop = () => {
        setExamineStop(!examineStop)
    }

    return (
        <div className="explore-route">
            {stops.length > 0 ? (
                <h1>Trip ID: {tripId} &emsp;Tractor ID: {stops[0].tractor_id}</h1>
            ) : (
                <h1>Loading...</h1>
            )}
            <div className="top-row">
                <ViewRoute
                    mapContainerRef={mapContainerRef}
                    mapInstance={mapInstance}
                    stops={stops}
                    routeGeoJson={routeGeoJson}
                    currentPosition={currentPosition}
                    mapStyle={mapStyle}
                />
                <ViewMetric
                    trips={trips}
                    stops={stops}
                    currentPosition={currentPosition}
                />
            </div>
            <div className="bottom-row">
                <PlaybackControls
                    totalDrivePoints={totalDrivePoints}
                    onPositionChange={handlePositionChange}
                    stopIndices={stopIndices}
                />
                <MapControls
                    stops={stops}
                    onChangeMapStyle={handleChangeMapStyle}
                    onExamineStop={handleExamineStop}
                    onToggleHeatMap={handleToggleHeatMap}
                />
            </div>
        </div>
    )
}

export default ExploreRoute