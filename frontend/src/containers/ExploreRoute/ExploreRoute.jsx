import React, { useEffect, useState, useRef } from 'react'
import { Box, Grid2, Typography } from '@mui/material'
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
    const [currentPosition, setCurrentPosition] = useState(0)
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

    const handlePositionChange = (position) => {
        setCurrentPosition(position)
    }

    return (
        <Box p={2}>
            <Typography variant="h4" gutterBottom>
                Trip #{tripId} - Tractor
            </Typography>
            <Grid2 container spacing={2}>
                {/* Left Side: Mappying Visualization */}
                <Grid2 item xs={9}>
                    <ViewRoute mapContainerRef={mapContainerRef} mapInstance={mapInstance} stops={stops} trips={trips} isDataLoading={loadingstops} currentPosition={currentPosition}/>
                    {/* Playback Controls */}
                    <PlaybackControls stops={stops} onPositionChange={handlePositionChange} />
                </Grid2>

                {/* Right Side: Metrics and Controls*/}
                <Grid2 item xs={3}>
                    <ViewMetric tripId={tripId} arrivalDate={arrivalDate} />
                    <MapControls />
                </Grid2>

            </Grid2>
        </Box>
    )
}

export default ExploreRoute