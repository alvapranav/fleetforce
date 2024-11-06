import React, { useEffect, useState, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import axios from 'axios'

const ViewRoute = ({ tripId, arrivalDate }) => {
  const mapContainerRef = useRef(null)
  const [mapInstance, setMapInstance] = useState(null)
  const [gpsPoints, setGpsPoints] = useState([]);
  const [stops, setStops] = useState([]);
  const [toArrivalDate, setToArrivalDate] = useState('')

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [-96, 37.8],
      zoom: 3,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    setMapInstance(map);

    return () => map.remove();
  }, []);

  useEffect(() => {
    if (!mapInstance) return

    const fetchTripsData = async () => {
      try {
        const response = await axios.get(`/api/trips/${tripId}/${arrivalDate}`)
        const tripsData = response.data
        setGpsPoints(tripsData)

        const endDate = gpsPoints.to_arrival_datetime
        setToArrivalDate(endDate);

        // Add route layer
        gpsPoints.on('load', () => {
          const routeGeoJson = {
            type: 'FeatureCollection',
            features: JSON.parse(gpsPoints[0].gps).map((point) => ({
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

          })

          const bounds = routeGeoJson.features.reduce((bounds, feature) => {
            return bounds.extend(feature.geometry.coordinates)
          }, new maplibregl.LngLatBounds(routeGeoJson.features[0].geometry.coordinates, routeGeoJson.features[0].geometry.coordinates))

          mapInstance.fitBounds(bounds, { padding: 20 })
        })
      }
      catch (error) {
        console.error('Error fetching GPS data:', error)
      }
    }

    fetchTripsData()

  }, [mapInstance, tripId, arrivalDate]);

  useEffect(() => {
    if (!toArrivalDate || !mapInstance) return;

    const fetchStopsData = async () => {
      try {
        const response = await axios.get(`/api/stops/${tripId}/${arrivalDate}/${toArrivalDate}`)
        setStops(response.data)

        console.log("hi")

        // Add stops markers
        response.data.forEach((stop) => {
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
      catch (error) {
        console.error('Error fetching Stops data:', error)
      }
    }
    fetchStopsData()
  }, [mapInstance, tripId, arrivalDate, toArrivalDate]);

  console.log(gpsPoints[0])
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
    <div className='map-container'>
      <div className='map' ref={mapContainerRef} />
    </div>
  )
}

export default ViewRoute