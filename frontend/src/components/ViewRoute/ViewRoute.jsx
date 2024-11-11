import React, { useEffect, useState, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import axios from 'axios'
import './ViewRoute.css'

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
      // style: 'https://demotiles.maplibre.org/style.json',
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
        console.log(stop.type_new)
        const el = document.createElement('div')
        el.className = 'marker'
        el.style.backgroundImage = `url(${getMarkerIcon(stop.type_new)})`
        el.style.width = '32px'
        el.style.height = '32px'

        new maplibregl.Marker(el)
          .setLngLat([stop.longitude, stop.latitude])
          .setPopup(new maplibregl.Popup().setHTML(`<h3>${stop.type_new}</h3>`))
          .addTo(mapInstance)
      })
      
    }

  }, [mapInstance, trips, stops, loadingstops]);

  console.log(trips)
  console.log(stops)

  const getMarkerIcon = (type) => {
    // Return the icon based on the type
    switch (type) {
      case 'start':
        return '/icons/start.png'
      case 'end':
        return '/icons/end.png'
      case 'fuel':
        return '/icons/fuel.png'
      case 'docking':
        return '/icons/docking.png'
      case 'overnight rest':
        return '/icons/overnight_rest.png'
      case 'short rest':
        return '/icons/short_rest.png'
      case 'fuel_ext':
        return '/icons/fuel_ext.png'
      case 'warehouse':
        return '/icons/warehouse.png'
      default:
        return '/icons/default.png'
    }
  }

  return (
    <div className='map-wrap'>
      <div ref={mapContainerRef} className='map'/>
    </div>
  )
}

export default ViewRoute