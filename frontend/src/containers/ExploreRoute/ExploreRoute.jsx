import React, { useEffect, useState, useRef } from 'react'
// import { Box, Grid2, Typography } from '@mui/material'
import maplibregl from 'maplibre-gl'
import axios from 'axios'
import wellknown from 'wellknown'
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
    const [drivePoints, setDrivePoints] = useState([])
    const [totalDrivePoints, setTotalDrivePoints] = useState(0)
    const [stopIndices, setStopIndices] = useState([])
    const [currentPosition, setCurrentPosition] = useState(0)
    const [mapStyle, setMapStyle] = useState('https://api.maptiler.com/maps/basic-v2/style.json?key=oGOTJkyBZPxrLa145LN6')
    const [examineStop, setExamineStop] = useState(false)
    const [isAtStop, setIsAtStop] = useState(true)
    const [unitTank, setUnitTank] = useState(null)
    const [animationSpeed, setAnimationSpeed] = useState(1)

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
                setToArrivalDate(endDate)
                setUnitTank(trips.unit_tank)

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
            setDrivePoints(processedData.drivePoints)
            setStopIndices(processedData.stopIndices)
            setTotalDrivePoints(processedData.drivePoints.length)

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
                        fuel: point['Tank Level Percent'],
                    },
                })),
            })
        }
    }, [trips, stops, loadingstops]);

    const processGPSData = ({ gpsData, stops }) => {
        const drivePoints = [];
        const stopIndices = [];

        let cumulativeDistance = 0

        gpsData.map((point) => {
            if (point.type === 'drive') {
                drivePoints.push({
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

                    stopIndices.push(drivePoints.length)
                    drivePoints.push(stopPoint)

                }
            }
        })

        return { drivePoints, stopIndices }

    }

    const handlePositionChange = (position) => {
        setCurrentPosition(position)
    }

    useEffect(() => {
        setIsAtStop(stopIndices.includes(currentPosition))
    }, [currentPosition, stopIndices])

    const handleChangeMapStyle = (style) => {
        setMapStyle(style)
        mapInstance.setStyle(style)
    }

    const handleToggleHeatMap = () => {
    }

    const removeOldPOIs = () => {
        mapInstance.getStyle().layers.forEach((layer) => {
            if (layer.id.includes('poi-layer')) {
                mapInstance.removeLayer(layer.id)
            }
        })
        Object.keys(mapInstance.style.sourceCaches).forEach((source) => {
            if (source.includes('poi-source')) {
                mapInstance.removeSource(source)
            }
        })
    }

    const handleExamineStop = () => {
        if (examineStop) {
            removeOldPOIs()
            mapInstance.flyTo({
                center: [drivePoints[currentPosition].long, drivePoints[currentPosition].lat],
                zoom: 8,
            })
            setExamineStop(!examineStop)
        } else {
            const stopPoint = stops[stopIndices.findIndex((index) => index === currentPosition)]
            if (stopPoint) {
                mapInstance.flyTo({
                    center: [stopPoint.longitude, stopPoint.latitude],
                    zoom: 16,
                })

                displayPlacesOfInterest(stopPoint)
            }
            setExamineStop(!examineStop)
        }
    }

    const parseGeometry = (geometryString) => {
        try {
            const geoJSON = wellknown.parse(geometryString)

            if (!geoJSON) {
                throw new Error('Invalid geometry')
            }

            return geoJSON
        } catch {
            console.error('Error parsing geometry:', geometryString)
            return null
        }
    }

    const getColorByIndex = (index) => {
        const colors = [
            '#FF0000',
            '#00FF00',
            '#0000FF',
            '#FFFF00',
            '#FF00FF',
        ]

        return colors[index]
    }

    const displayPlacesOfInterest = (poiDictionary) => {
        const places = []

        for (let i = 1; i <= 5; i++) {
            const place_name = poiDictionary[`nearest${i}_name`]
            const amenity = poiDictionary[`nearest${i}_amenity`]
            const building = poiDictionary[`nearest${i}_building`]
            const shop = poiDictionary[`nearest${i}_shop`]
            const highway = poiDictionary[`nearest${i}_highway`]
            const geometry = poiDictionary[`nearest${i}_geometry`]
            const latitude = poiDictionary[`nearest${i}_latitude`]
            const longitude = poiDictionary[`nearest${i}_longitude`]


            if (!geometry) continue

            places.push({
                latitude: latitude,
                longitude: longitude,
                placeName: place_name,
                amenityType: amenity,
                buildingType: building,
                shopType: shop,
                highwayType: highway,
                geometry: geometry
            })
        }

        places.forEach((poi, index) => {
            const geometry = parseGeometry(poi.geometry)
            const color = getColorByIndex(index)

            const sourceId = `poi-source-${index}`
            const layerId = `poi-layer-${index}`

            if (!mapInstance.getSource(sourceId)) {
                mapInstance.addSource(sourceId, {
                    type: 'geojson',
                    data: geometry
                })

                mapInstance.addLayer({
                    id: layerId,
                    type: 'fill',
                    source: sourceId,
                    paint: {
                        'fill-color': color,
                        'fill-opacity': 0.5
                    }
                })

                mapInstance.on('click', layerId, () => {
                    new maplibregl.Popup()
                        .setLngLat([poi.longitude, poi.latitude])
                        .setHTML(
                            `<strong>Name:</strong> ${poi.placeName || 'Unknown'}<br>
                        <strong>Amenity:</strong> ${poi.amenityType || 'N/A'}<br>
                        <strong>Building:</strong> ${poi.buildingType || 'N/A'}<br>
                        <strong>Shop:</strong> ${poi.shopType || 'N/A'}<br>
                        <strong>Highway:</strong> ${poi.highwayType || 'N/A'}
                        `
                        )
                        .addTo(mapInstance)
                })
            }
        })

    }


    return (
        <div className="explore-route">
            {stops.length > 0 ? (
                <h1 className='heading'>Trip ID: {tripId} &emsp;Tractor ID: {stops[0].tractor_id}</h1>
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
                    drivePoints={drivePoints}
                    examineStop={examineStop}
                />
                <ViewMetric
                    currentPosition={currentPosition}
                    drivePoints={drivePoints}
                    unitTank={unitTank}
                    stops = {stops}
                    stopIndices = {stopIndices}
                    isAtStop={isAtStop}
                />
            </div>
            <div className="bottom-row">
                <PlaybackControls
                    totalDrivePoints={totalDrivePoints}
                    onPositionChange={handlePositionChange}
                    stopIndices={stopIndices}
                    animationSpeed={animationSpeed}
                />
                <MapControls
                    stops={stops}
                    onChangeMapStyle={handleChangeMapStyle}
                    onExamineStop={handleExamineStop}
                    isAtStop={isAtStop}
                    onToggleHeatMap={handleToggleHeatMap}
                    animationSpeed={animationSpeed}
                    onAnimationSpeedChange={setAnimationSpeed}
                />
            </div>
        </div>
    )
}

export default ExploreRoute