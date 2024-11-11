import React, { useEffect, useState, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import axios from 'axios'
import './ViewRoute.css'
import { icons } from '../../constants'
import PinBase from '../../assets/location-pin-solid'

const ViewRoute = ({ tripId, arrivalDate }) => {
  const mapContainerRef = useRef(null)
  const map = useRef(null)
  const [mapInstance, setMapInstance] = useState(null)
  const [trips, setTrips] = useState(null);
  const [stops, setStops] = useState([]);
  const [toArrivalDate, setToArrivalDate] = useState('')
  const [loadingtrips, setLoadingTrips] = useState(true)
  const [loadingstops, setLoadingStops] = useState(true)

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://api.maptiler.com/maps/basic-v2/style.json?key=oGOTJkyBZPxrLa145LN6",
      center: [139.753, 35.6844],
      zoom: 14,
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
        console.log(toArrivalDate)

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
    if (!mapInstance) return;

    if (trips && stops.length > 0 && loadingstops === false) {
      var gpsData = trips.gps
      gpsData = JSON.parse(gpsData)

      // Add route layer
      const routeGeoJson = {
        type: 'FeatureCollection',
        features: gpsData.map((point) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [point.Longitude_gps, point.Latitude_gps],
          },
          properties: {
            timestamp: point.Dt,
          },
        })),
      }

      mapInstance.on('load', () => {
        if (mapInstance.getSource('route')) {
          mapInstance.getSource('route').setData(routeGeoJson)
        } else {
          mapInstance.addSource('route', {
            type: 'geojson',
            data: routeGeoJson,
          })

          mapInstance.addLayer({
            id: 'route-points',
            source: 'route',
            type: 'circle',
            paint: {
              'circle-color': 'gray',
              'circle-radius': 6,
            },
          })
        }

        const bounds = routeGeoJson.features.reduce((bounds, feature) => {
          return bounds.extend(feature.geometry.coordinates)
        }, new maplibregl.LngLatBounds(routeGeoJson.features[0].geometry.coordinates, routeGeoJson.features[0].geometry.coordinates))

        mapInstance.fitBounds(bounds, { padding: 20 })

      })

      // Add stops markers
      stops.forEach((stop) => {
        const el = document.createElement('div')
        el.className = 'custom-marker'

        const IconComponent = getMarkerIcon(stop.type_new)

        const root = createRoot(el)
        root.render(
          <div className='pin-base'>
            <PinBase 
              fill={getMarkerColor(stop.type_new)}
              width={30}
              height={42}
              style={{position: 'absolute', top: 0, left: 0}}
            />
            <div className='pin-icon'>
            {IconComponent && 
            <IconComponent
              width={18}
              height={18}
              fill={getIconColor(stop.type_new)}
              style={{position: 'absolute', top: 6}}
            />}
            </div>
          </div>
        )

        // const base = document.createElement('div')
        // base.className = 'pin-base'
        // base.style.backgroundColor = getMarkerColor(stop.type_new)

        // const icon = document.createElement('img')
        // icon.src = getMarkerIcon(stop.type_new)
        // icon.className = 'pin-icon'

        // base.appendChild(icon)
        // el.appendChild(base)

        new maplibregl.Marker({element: el, anchor: 'bottom'})
          .setLngLat([stop.longitude, stop.latitude])
          .setPopup(new maplibregl.Popup().setHTML(`<h3>${stop.type_new}</h3>`))
          .addTo(mapInstance)
      })

    }

  }, [mapInstance, trips, stops, loadingstops]);

  const getMarkerIcon = (type) => {
    // Return the icon based on the type
    switch (type) {
      case 'start':
        return icons.Home
      case 'end':
        return icons.Checkered
      case 'fuel':
        return icons.GasPump
      case 'docking':
        return icons.Ramp
      case 'overnight rest':
        return icons.Bed
      case 'short rest':
        return icons.Meal
      case 'fuel_ext':
        return icons.GasPump
      case 'warehouse':
        return icons.Warehouse
      default:
        return icons.Flag
    }
  }

  const getMarkerColor = (type) => {
    switch (type) {
      case 'start':
        return '#FFA500'
      case 'end':
        return '#2E8B57'
      case 'fuel':
        return '#FFD700'
      case 'fuel_ext':
        return '#FFC107'
      case 'docking':
        return '#1E90FF'
      case 'overnight rest':
        return '#9370DB'
      case 'warehouse':
        return '#9370DB'
      case 'short rest':
        return '#1E90FF'    
      default:
        return '#1E90FF'
    }
  }

  const getIconColor = (type) => {
    switch (type) {
      case 'start':
        return '#995C00'
      case 'end':
        return '#1C5A3C'
      case 'fuel':
        return '#997300'
      case 'fuel_ext':
        return '#8F6A04'
      case 'docking':
        return '#0F4A7A'
      case 'overnight rest':
        return '#4D2A73'
      case 'warehouse':
        return '#4D2A73'
      case 'short rest':
        return '#0F4A7A'    
      default:
        return '#0F4A7A'
    }
  }

  return (
    <div className='map-wrap'>
      <div ref={mapContainerRef} className='map' />
      <PinBase 
              fill={'#FFA500'}
            /> 
    </div>
  )
}

export default ViewRoute