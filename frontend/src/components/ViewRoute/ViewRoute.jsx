import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './ViewRoute.css'
import { icons } from '../../constants'
import PinBase from '../../assets/location-pin-solid'

const ViewRoute = ({ mapContainerRef, mapInstance, stops, routeGeoJson, currentPosition, mapStyle, drivePoints, examineStops, heatmapOption }) => {
  const layersRef = useRef([])
  const markersRef = useRef([])
  const [truckMarker, setTruckMarker] = useState(null)

  useEffect(() => {
    if (!mapInstance || !routeGeoJson) return;

    const speedStops = [
      [0, 'red'],
      [30, 'orange'],
      [50, 'yellow'],
      [80, 'green']
    ]

    mapInstance.on('load', () => {
      if (mapInstance.getSource('route')) {
        mapInstance.getSource('route').setData(routeGeoJson)
      } else {
        mapInstance.addSource('route', {
          type: 'geojson',
          data: routeGeoJson,
        })

        const layer = {
          id: 'route-points',
          source: 'route',
          type: 'circle',
          paint: {
            'circle-radius': 4,
            'circle-color': [
              'interpolate',
              ['linear'],
              ['get', 'speed'],
              ...speedStops.flat(),
            ],
          },
        }

        mapInstance.addLayer(layer)

        layersRef.current.push(layer)
      }

      const bounds = routeGeoJson.features.reduce((bounds, feature) => {
        return bounds.extend(feature.geometry.coordinates)
      }, new maplibregl.LngLatBounds(routeGeoJson.features[0].geometry.coordinates, routeGeoJson.features[0].geometry.coordinates))

      mapInstance.fitBounds(bounds, { padding: 60 })

    })

    // Add stops markers
    stops.forEach((stop) => {
      const el = document.createElement('div')
      el.className = 'custom-marker'
      el.id = 'custom-marks'

      const IconComponent = getMarkerIcon(stop.type_new)

      const root = createRoot(el)
      root.render(
        <div className='pin-base'>
          <PinBase
            fill={getMarkerColor(stop.type_new)}
            width={30}
            height={42}
            style={{ position: 'absolute', top: 0, left: 0 }}
          />
          <div className='pin-icon'>
            {IconComponent &&
              <IconComponent
                width={18}
                height={18}
                fill={getIconColor(stop.type_new)}
                style={{ position: 'absolute', top: 6 }}
              />}
          </div>
        </div>
      )

      const popupContent = createPopupContent(stop)

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([stop.longitude, stop.latitude])
        .setPopup(new maplibregl.Popup().setDOMContent(popupContent))
        .addTo(mapInstance)

      markersRef.current.push(marker)
    })

    const point = drivePoints[currentPosition]
    const latitude = point.lat
    const longitude = point.long

    const el = document.createElement('div')
    el.className = 'truck-marker'
    el.style.transform = 'rotate(0deg)'
    el.style.width = '20px'
    el.style.height = '20px'
    el.innerHTML = `<img src=${icons.Truck} alt='truck' />`

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([longitude, latitude])
      .addTo(mapInstance)
    setTruckMarker(marker)

  }, [routeGeoJson]);

  useEffect(() => {
    if (!mapInstance || !routeGeoJson) return;

    const getColorExpression = () => {
      if (heatmapOption === 'Speed') {
        return [
          'interpolate',
          ['linear'],
          ['get', 'speed'],
          0, 'red',
          30, 'orange',
          50, 'yellow',
          80, 'green'
        ]
      } else if (heatmapOption === 'Mileage') {
        return [
          'interpolate',
          ['linear'],
          ['get', 'mileage'],
          -1, 'red',
          0, 'orange',
          1, 'yellow',
          7, 'green'
        ]
      }
    }

    if (mapInstance.getLayer('route-points')) {
      mapInstance.setPaintProperty('route-points', 'circle-color', getColorExpression())

      const updatedLayer = {
        id: 'route-points',
        source: 'route',
        type: 'circle',
        paint: {
          'circle-radius': 4,
          'circle-color': getColorExpression(),
        },
      }
      layersRef.current = layersRef.current.filter((layer) => layer.id !== 'route-points')
      layersRef.current.push(updatedLayer)
    }

  }, [heatmapOption])

  useEffect(() => {
    if (!mapInstance || !routeGeoJson) return;

    mapInstance.on('styledata', () => {
      restoreLayers();
      restoreMarkers();
    })
  }, [mapInstance, mapStyle]);

  const restoreLayers = () => {
    if (mapInstance.getSource('route')) {
      mapInstance.getSource('route').setData(routeGeoJson)
    } else {
      mapInstance.addSource('route', {
        type: 'geojson',
        data: routeGeoJson,
      })
      layersRef.current.forEach((layer) => {
        mapInstance.addLayer(layer)
      })
    }
  }

  const restoreMarkers = () => {
    markersRef.current.forEach((marker) => {
      marker.addTo(mapInstance)
    })
  }

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

  const createPopupContent = (stop) => {
    const container = document.createElement('div')
    container.className = 'popup-content'

    const isFuelStop = stop.type_new === 'fuel'

    const arrivalTime = new Date(stop.arrival_datetime).toLocaleString()
    const departureTime = new Date(stop.departure_datetime).toLocaleString()

    const dwellTimeMinutes = stop.dwell_time
    const dwellHours = Math.floor(dwellTimeMinutes / 3600)
    const dwellMinutes = Math.floor((dwellTimeMinutes % 3600) / 60)
    const dwellTimeFormatted = `${dwellHours}h ${dwellMinutes}m`

    container.innerHTML = `
      <h3>${capitalizeFirstLetter(stop.type_new)}</h3>
      <p"><strong>Arrival Time:</strong> ${arrivalTime}</p>
      <p"><strong>Departure Time:</strong> ${departureTime}</p>
      <p"><strong>Dwell Time:</strong> ${dwellTimeFormatted}</p>
      <p"><strong>Miles From Last Stop:</strong> ${stop.miles_travelled.toFixed(2)} miles</p>
      <p"><strong>Fuel Tank Before Stop:</strong> ${(stop.fuel_tank_percent_before * 100).toFixed(2)}%</p>
      <p"><strong>Fuel Tank After Stop:</strong> ${(stop.fuel_tank_percent_after * 100).toFixed(2)}%</p>
      ${isFuelStop ? `
        <p"><strong>Location Name:</strong> ${stop.fuel_location_name}</p>
        <p"><strong>Unit Price:</strong> $${stop.unit_price.toFixed(2)} /Gallon</p>
        <p"><strong>Total Cost:</strong> $${stop.total_cost.toFixed(2)}</p>
        <p"><strong>Quantity:</strong> ${stop.quantity.toFixed(2)} Gallons</p>
        <p"><strong>City:</strong> ${stop.city}</p>
        <p"><strong>State:</strong> ${stop.state}</p>
        ` : ''}
      <a href="https://www.google.com/maps?q=${stop.latitude},${stop.longitude}" target="_blank">View on Google Maps</a>
      `;

    return container
  }

  const capitalizeFirstLetter = (string) => {
    return string
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  mapInstance && mapInstance.on('click', 'route-points', (e) => {
    const coordinates = e.features[0].geometry.coordinates.slice()
    const lng = coordinates[0]
    const lat = coordinates[1]
    const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`
    const arrivalTime = new Date(e.features[0].properties.timestamp).toLocaleString()

    const popupContent = document.createElement('div')
    popupContent.className = 'popup-content';

    popupContent.innerHTML = `
      <h3>GPS Data</h3>
      <p> Timestamp: ${arrivalTime}</p>
      <p> Latitude: ${lat.toFixed(6)}</p>
      <p> Longitude: ${lng.toFixed(6)}</p>
      <p> Speed: ${e.features[0].properties.speed.toFixed(2)} mph</p>
      <p> Mileage: ${e.features[0].properties.mileage.toFixed(2)} miles/gallon</p>
      <p> Fuel: ${e.features[0].properties.fuel.toFixed(2)}%</p>
      <a href="${googleMapsUrl}" target="_blank">View on Google Maps</a>
    `

    new maplibregl.Popup()
      .setLngLat(coordinates)
      .setDOMContent(popupContent)
      .addTo(mapInstance)

  })

  mapInstance && mapInstance.on('mouseenter', 'route-points', () => {
    mapInstance.getCanvas().style.cursor = 'pointer'
  })

  mapInstance && mapInstance.on('mouseleave', 'route-points', () => {
    mapInstance.getCanvas().style.cursor = ''
  })

  useEffect(() => {
    if (!mapInstance || !drivePoints[currentPosition]) return;

    const point = drivePoints[currentPosition]
    const latitude = point.lat
    const longitude = point.long

    if (!truckMarker) {
      const el = document.createElement('div')
      el.className = 'truck-marker'
      el.style.transform = 'rotate(0deg)'
      el.style.width = '30px'
      el.style.height = '30px'
      el.innerHTML = `<img src=${icons.Truck} alt='truck' />`

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([longitude, latitude])
        .addTo(mapInstance)
      setTruckMarker(marker)
    } else {
      truckMarker.setLngLat([longitude, latitude])
    }

    if (currentPosition > 0) {
      mapInstance.panTo([longitude, latitude], { duration: 100, easing: (t) => t * (2 - t) })
      // mapInstance.easeTo({center: [longitude, latitude], duration: 600, easing: (t) => t * (2 - t)})
    } else {
      const bounds = routeGeoJson.features.reduce((bounds, feature) => {
        return bounds.extend(feature.geometry.coordinates)
      }, new maplibregl.LngLatBounds(routeGeoJson.features[0].geometry.coordinates, routeGeoJson.features[0].geometry.coordinates))

      mapInstance.fitBounds(bounds, { padding: 60 })
    }

  }, [currentPosition, examineStops])

  return (
    <div className='map-wrap'>
      <div ref={mapContainerRef} className='map' />
    </div>
  )
}

export default ViewRoute