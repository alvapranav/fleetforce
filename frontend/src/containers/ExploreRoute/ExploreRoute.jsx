import React, { useEffect, useState, useRef } from 'react'
// import { Box, Grid2, Typography } from '@mui/material'
import { useParams } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import axios from 'axios'
import wellknown from 'wellknown'
import { ViewMetric, ViewRoute, PlaybackControls, MapControls, FindStops } from '../../components'
import { Button } from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import './ExploreRoute.css'


const ExploreRoute = () => {
    const { tractorId, arrivalDate, toArrivalDate } = useParams()
    const mapContainerRef = useRef(null)
    const map = useRef(null)
    const markersRef = useRef([])
    const [mapInstance, setMapInstance] = useState(null)
    const [trips, setTrips] = useState(null);
    const [stops, setStops] = useState([]);
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
    const [heatmapOption, setHeatmapOption] = useState('Speed')
    const [tripKey, setTripKey] = useState(`${tractorId}-${arrivalDate}`)
    const [loading, setLoading] = useState(false)
    const [cancelSource, setCancelSource] = useState(null)
    const [highlightTimes, setHighlightTimes] = useState([])
    const [foundStops, setFoundStops] = useState([])
    const [highlightMode, setHighlightMode] = useState(null)
    const [weatherOption, setWeatherOption] = useState('None')
    const OWM_API_KEY = '6d66a9e334393950470297fe47208de9'
    const navigate = useNavigate()
    const { state } = useLocation()

    useEffect(() => {
        if (map.current) return;

        map.current = new maplibregl.Map({
            container: mapContainerRef.current,
            style: mapStyle,
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

                const response = await axios.get(`/api/trip/${tractorId}/${arrivalDate}`)
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

    }, [mapInstance, tractorId, arrivalDate]);

    useEffect(() => {
        if (!mapInstance) return
        const fetchStopsData = async () => {
            try {

                setLoadingStops(true)

                // const endDate = trips.to_arrival_datetime
                // setToArrivalDate(endDate)

                const ut = trips.unit_tank
                setUnitTank(ut)

                const response = await axios.get(`/api/stops/${tractorId}/${arrivalDate}/${toArrivalDate}`)
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

    }, [mapInstance, tractorId, arrivalDate, trips, loadingtrips, toArrivalDate]);

    useEffect(() => {
        // if (!mapInstance || loadingstops) return;

        if (!loadingstops && stops.length > 0) {

            // REMOVE old markers
            markersRef.current.forEach((marker) => {
                marker.remove()
            })
            markersRef.current = []


            // if (currentPosition === 0) {
            var gpsData = trips.gps
            // gpsData = JSON.parse(gpsData)

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

    useEffect(() => {
        if (examineStop && isAtStop) {
            const stopPoint = stops[stopIndices.findIndex((index) => index === currentPosition)]
            if (stopPoint) {
                removeOldPOIs()
                displayPlacesOfInterest(stopPoint)
                mapInstance.flyTo({
                    center: [stopPoint.longitude, stopPoint.latitude],
                    zoom: 16,
                })
            }
        }
    }, [currentPosition, examineStop, isAtStop])

    const WEATHER_SOURCE_ID = 'rainviewer-source'
    const WEATHER_LAYER_ID = 'rainviewer-layer'

    useEffect(() => {
        if (!mapInstance) return

        if (weatherOption === 'None') {
            if (mapInstance.getLayer(WEATHER_LAYER_ID)) {
                mapInstance.removeLayer(WEATHER_LAYER_ID)
            }
            if (mapInstance.getSource(WEATHER_SOURCE_ID)) {
                mapInstance.removeSource(WEATHER_SOURCE_ID)
            }
            return
        }

        const currentPoint = drivePoints[currentPosition]
        if (!currentPoint) return

        const dt = new Date(currentPoint.time)
        // const currentTimestamp = Math.floor(Date.now() / 1000)
        const unixTimeSec = Math.floor(dt.getTime() / 1000)

        const OWM_URL = `https://tile.openweathermap.org/map/${weatherOption}/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`

        if (mapInstance.getLayer(WEATHER_LAYER_ID)) {
            mapInstance.removeLayer(WEATHER_LAYER_ID)
        }
        if (mapInstance.getSource(WEATHER_SOURCE_ID)) {
            mapInstance.removeSource(WEATHER_SOURCE_ID)
        }

        mapInstance.addSource(WEATHER_SOURCE_ID, {
            type: 'raster',
            tiles: [OWM_URL],
            tileSize: 256,
            scheme: 'xyz'
        })

        mapInstance.addLayer({
            id: WEATHER_LAYER_ID,
            type: 'raster',
            source: WEATHER_SOURCE_ID,
            paint: {
                'raster-opacity': 0.8
            }
        })

    }, [mapInstance, weatherOption, currentPosition])

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
        // mapInstance.setStyle(style)
        setMapStyle(style)
    }

    const handleToggleHeatMap = (option) => {
        setHeatmapOption(option)
    }

    const handleTripSelect = (newTractorId, newArrivalDate) => {
        setCurrentPosition(0)
        setTripKey(`${newTractorId}-${newArrivalDate}-${Date.now()}`)
    }

    const handleCancelRequest = () => {
        if (cancelSource) {
            cancelSource.cancel('Request cancelled by user')
        }
        setLoading(false)
    }

    const clearHighlightAndStops = () => {
        setHighlightTimes([])
        setFoundStops([])
        setHighlightMode(null)
    }

    const toggleFuelStops = async () => {
        if (highlightMode === 'fuel') {
            clearHighlightAndStops()
            return
        } else {
            clearHighlightAndStops()
        }

        if (!drivePoints.length || !unitTank) return;
        // check if current fuel < 0.50
        const currentFuelLevel = drivePoints[currentPosition].fuel
        if (currentFuelLevel >= 0.50) {
            console.log('Fuel level is above 50%, not searching for fuel stops')
            return
        }

        setLoading(true)
        const source = axios.CancelToken.source()
        setCancelSource(source)

        try {
            const effectiveUnitTank = unitTank ?? 150
            const mpg = 7.0
            const tankSize = effectiveUnitTank
            let currentFuelFrac = currentFuelLevel
            let idx = currentPosition
            let subRoute = []
            let subRouteTime = []

            while (idx < drivePoints.length && currentFuelFrac >= 0.15) {
                const pt = drivePoints[idx]
                subRoute.push({ lat: pt.lat, long: pt.long })
                subRouteTime.push(pt.time)
                const distMiles = pt.dist * 0.000621371
                const usedFrac = (distMiles / mpg) / tankSize
                currentFuelFrac -= usedFrac
                idx++
            }

            setHighlightTimes(subRouteTime)

            const resp = await axios.post('/api/findFuelStops', {
                subRoute
            }, { cancelToken: source.token })

            const found = resp.data
            setFoundStops(found)
            setHighlightMode('fuel')
        } catch (err) {
            if (axios.isCancel(err)) {
                console.log('Fuel search cancelled:', err.message)
            } else {
                console.error('Error finding fuel stops:', err)
            }
        } finally {
            setLoading(false)
        }
    }

    const toggleRestStops = async () => {

        if (highlightMode === 'rest') {
            clearHighlightAndStops()
            return
        }

        if (highlightMode === 'fuel') {
            clearHighlightAndStops()
        }

        if (!drivePoints.length) return;
        setLoading(true)
        const source = axios.CancelToken.source()
        setCancelSource(source)

        try {
            let currentSpeedMph = 55
            const lastPt = drivePoints[currentPosition]
            let distanceRemaining = currentSpeedMph * 4
            let idx = currentPosition
            let traveled = 0
            let routeSeg = []
            let routeSegTime = []
            while (idx < drivePoints.length && distanceRemaining > 0) {
                const pt = drivePoints[idx]
                routeSeg.push({ lat: pt.lat, long: pt.long })
                routeSegTime.push(pt.time)
                const distM = pt.dist * 0.000621371
                traveled += distM
                distanceRemaining -= distM
                idx++
            }

            setHighlightTimes(routeSegTime)

            const resp = await axios.post('/api/findRestStops', {
                routeSegment: routeSeg
            }, { cancelToken: source.token })
            setFoundStops(resp.data)
            setHighlightMode('rest')
        } catch (err) {
            if (axios.isCancel(err)) {
                console.log('Rest search cancelled:', err.message)
            } else {
                console.error('Error finding rest stops:', err)
            }
        } finally {
            setLoading(false)
        }
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
            <div className="header">
                {stops.length > 0 ? (
                    <h1 className='heading'>Tractor ID: {stops[0].tractor_id}</h1>
                ) : (
                    <h1>Loading...</h1>
                )}

                <Button
                    variant="outlined"
                    onClick={() => {
                        if (state?.filters) {
                            console.log('back to trips')
                            navigate('/', { state: { ...state } })
                        } else {
                            navigate('/')
                        }
                    }}
                    style={{ marginBottom: '10px', marginLeft: '10px', color: 'white', marginTop: '10px' }}
                >
                    &larr; Back to Trips
                </Button>
            </div>
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
                    heatmapOption={heatmapOption}
                    highlightTimes={highlightTimes}
                    foundStops={foundStops}
                    highlightMode={highlightMode}
                />
                <ViewMetric
                    currentPosition={currentPosition}
                    drivePoints={drivePoints}
                    unitTank={unitTank}
                    stops={stops}
                    stopIndices={stopIndices}
                    isAtStop={isAtStop}
                    tractorId={tractorId}
                    arrivalDate={arrivalDate}
                    onTripSelect={handleTripSelect}
                    onResetPlayback={() => setCurrentPosition(0)}
                />
            </div>
            <div className="bottom-row">
                <PlaybackControls
                    totalDrivePoints={totalDrivePoints}
                    onPositionChange={handlePositionChange}
                    stopIndices={stopIndices}
                    animationSpeed={animationSpeed}
                    examineStop={examineStop}
                    stops={stops}
                    drivePoints={drivePoints}
                    tripKey={tripKey}
                />
                <MapControls
                    onChangeMapStyle={handleChangeMapStyle}
                    onExamineStop={handleExamineStop}
                    examineStop={examineStop}
                    isAtStop={isAtStop}
                    onToggleHeatmap={handleToggleHeatMap}
                    animationSpeed={animationSpeed}
                    onAnimationSpeedChange={setAnimationSpeed}
                    unitTank={unitTank}
                    onToggleWeather={setWeatherOption}
                    weatherOption={weatherOption}
                />
                <div className='optimizer'>
                    <h4>Optimizer</h4>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={toggleFuelStops}
                        style={{ margin: '10px' }}
                        disabled={!drivePoints[currentPosition] ||
                            (drivePoints[currentPosition].fuel >= 0.50 && highlightMode !== 'fuel')}
                    > {highlightMode === 'fuel' ? 'Clear Fuel' : 'Find Fuel'}
                    </Button>
                    <Button
                        variant="contained"
                        color="secondary"
                        onClick={toggleRestStops}
                        style={{ margin: '10px' }}
                    >
                        {highlightMode === 'rest' ? 'Clear Rest' : 'Find Rest'}
                    </Button>
                </div>
            </div>

            {loading && (
                <div className='loading-overlay'>
                    <div className='loading-content'>
                        <div className='spinner'></div>
                        <p>Loading, please wait...</p>
                        <button onClick={handleCancelRequest}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ExploreRoute