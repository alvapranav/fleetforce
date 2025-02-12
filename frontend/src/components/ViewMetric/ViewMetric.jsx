import { Tabs, Tab, LinearProgress, Box, Typography } from '@mui/material'
import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

// Helper to convert distance in meters to miles
const metersToMiles = (m) => {
  if (!m) return '';
  const miles = m * 0.000621371;
  return miles.toFixed(2);  // e.g. "12.35"
};

const formatTimeTaken = (seconds) => {
  if (!seconds || seconds <= 0) return '';
  let days = Math.floor(seconds / 86400);
  let remainder = seconds % 86400;
  let hrs = remainder / 3600.0;

  if (days > 0) {
    return `${days} day(s), ${hrs.toFixed(1)} hr(s)`;
  } else {
    return `${hrs.toFixed(1)} hr(s)`;
  }
};

// Convert dwell seconds to hours
const formatDwellHours = (seconds) => {
  if (!seconds || seconds <= 0) return '';
  const hrs = seconds / 3600;
  return hrs.toFixed(2); // e.g. "3.45"
};

const ViewMetric = ({ currentPosition, drivePoints, unitTank, stops, stopIndices, isAtStop, tractorId, arrivalDate, onTripSelect, onResetPlayback }) => {
  const [activeTab, setActiveTab] = useState(0)

  const [metrics, setMetrics] = useState({
    distanceDriven: 0,
    timeTaken: 0,
    fuelLevel: 0,
    totalDwellTime: 0,
    amountSpent: 0,
    fuelPurchased: 0,
    fuelConsumed: 0,
    milesPerGallon: 0
  })

  const [stopMetrics, setStopMetrics] = useState({
    arrivalTime: 0,
    departureTime: 0,
    dwellTime: 0,
    milesFromLastStop: 0,
    fuelBeforeStop: 0,
    fuelAfterStop: 0,
    locationName: '',
    unitPrice: 0,
    totalCost: 0,
    quantity: 0,
    city: '',
    state: '',
  })

  const [tractorTrips, setTractorTrips] = useState([])
  const [loadingTractorTrips, setLoadingTractorTrips] = useState(true)

  const [isFuelStop, setIsFuelStop] = useState(false)
  const history = useNavigate();

  const getFuelBarColor = (value) => {
    if (value > 75) {
      return 'green'
    }
    if (value > 50) {
      return 'yellow'
    }
    if (value > 25) {
      return 'orange'
    }
    return 'red'
  }

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    return `${hours}h ${mins}m`
  }

  useEffect(() => {
    if (!loadingTractorTrips) return;

    const fetchTripsData = async () => {
      try {
        setLoadingTractorTrips(true)

        const response = await axios.get(`/api/tractor_trips/${tractorId}`)
        const tripsData = response.data

        setTractorTrips(tripsData)

        setLoadingTractorTrips(false)

      }
      catch (error) {
        console.error('Error fetching trips data:', error)
        setLoadingTractorTrips(false)
      }
    }

    fetchTripsData()
  }, [tractorId])

  useEffect(() => {
    const calculateMetrics = () => {
      const points = drivePoints.slice(0, currentPosition + 1)
      let fuel_index = 0
      let distanceDriven = 0
      let timeTaken = new Date(drivePoints[currentPosition].time) - new Date(drivePoints[0].time)
      let fuelConsumed = 0
      let totalDwellTime = 0
      let fuelPurchased = 0
      let amountSpent = 0

      for (let i = 0; i < points.length - 1; i++) {
        const prevPoint = points[i]
        const currentPoint = points[i + 1]

        distanceDriven += currentPoint.dist * 0.000621371

        const stopPoint = stops[stopIndices.findIndex((index) => index === i + 1)]

        if (stopPoint) {
          totalDwellTime += stopPoint.dwell_time / 60
          fuelPurchased += stopPoint.quantity
          amountSpent += stopPoint.total_cost
          if (stopPoint.type_new == 'fuel' || stopPoint.type_new == 'fuel_ext') {
            fuelConsumed += (drivePoints[fuel_index].fuel - stopPoint.fuel_tank_percent_before) * unitTank
            fuel_index = i + 1
          }
        }
      }

      fuelConsumed += (drivePoints[fuel_index].fuel - drivePoints[currentPosition].fuel) * unitTank

      const stopPoint = stops[stopIndices.findIndex((index) => index === currentPosition)]

      if (stopPoint) {
        const arrivalTime = new Date(stopPoint.arrival_datetime)
        const departureTime = new Date(stopPoint.departure_datetime)
        const dwellTime = stopPoint.dwell_time
        const milesFromLastStop = currentPosition === 0 ? 0 : stopPoint.miles_travelled
        const fuelBeforeStop = stopPoint.fuel_tank_percent_before * 100
        const fuelAfterStop = stopPoint.fuel_tank_percent_after * 100
        if (stopPoint.type_new == 'fuel') {
          setIsFuelStop(true)
          setStopMetrics({
            arrivalTime,
            departureTime,
            dwellTime: dwellTime / 60,
            milesFromLastStop,
            fuelBeforeStop,
            fuelAfterStop,
            locationName: stopPoint.fuel_location_name,
            unitPrice: stopPoint.unit_price,
            totalCost: stopPoint.total_cost,
            quantity: stopPoint.quantity,
            city: stopPoint.city,
            state: stopPoint.state,
          })
        }
        else {
          setIsFuelStop(false)
          setStopMetrics({
            arrivalTime,
            departureTime,
            dwellTime: dwellTime / 60,
            milesFromLastStop,
            fuelBeforeStop,
            fuelAfterStop,
            locationName: '',
            unitPrice: 0,
            totalCost: 0,
            quantity: 0,
            city: '',
            state: '',
          })
        }

      }

      setMetrics({
        distanceDriven,
        timeTaken: timeTaken / 60000,
        fuelLevel: drivePoints[currentPosition].fuel * 100,
        totalDwellTime,
        amountSpent,
        fuelPurchased,
        fuelConsumed,
        milesPerGallon:
          fuelConsumed > 0 && distanceDriven > 0
            ? (distanceDriven / fuelConsumed).toFixed(2)
            : "N/A"
      })

    }

    if (drivePoints.length > 0) {
      calculateMetrics()
    }

  }, [currentPosition, drivePoints, stops, stopIndices, unitTank, isAtStop])

  const checkIfContinuous = (idx) => {
    if (idx > tractorTrips.length - 1 || idx == 0) return false

    const current = tractorTrips[idx]
    const prev = tractorTrips[idx - 1]

    const continuousCity = current.city === prev.to_city
    const continuousState = current.state === prev.to_state
    const continuousTime = current.arrival_datetime === prev.to_arrival_datetime

    return continuousCity && continuousState && continuousTime
  }

  const renderTractorTimeline = () => {
    if (!tractorTrips || tractorTrips.length === 0) {
      return <p>No tractor trips available</p>
    }
    return (
      <div >
        {tractorTrips.map((tripItem, idx) => {
          const isCurrent = tripItem.arrival_datetime === arrivalDate
          const continuous = checkIfContinuous(idx)

          return (
            <div
              key={tripItem.arrival_datetime}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
            >
              {idx > 0 && (
                continuous
                  ? <div syle={{ width: '2px', height: '20px', backgroundColor: 'black' }} />
                  : <div style={{ height: '10px' }} />
              )}

              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: isCurrent ? 'blue' : '#555',
                margin: '10px',
              }} />

              <p style={{ margin: 0, paddingInlineStart: '30px', marginBlockEnd: '10px' }}>{tripItem.city}, {tripItem.state}</p>

              {/* {isCurrent && (
                <p style={{ margin: 0, marginLeft: '8px', color: 'blue', fontWeight: 'bold' }}>
                  Current Trip's End
                </p>
              )} */}

              <div
                style={{
                  border: isCurrent ? '2px solid blue' : '1px solid #ccc',
                  marginLeft: '30px',
                  padding: '5px',
                  cursor: 'pointer',
                }}
                onClick={() => handleTimelineClick(tripItem)}
              >
                <p>Time Taken: {formatTimeTaken(tripItem.time_taken)}</p>
                <p>Distance: {metersToMiles(tripItem.distance_travelled)} miles</p>
                <p>Stops: {tripItem.total_stops}, Dwell: {formatDwellHours(tripItem.total_dwell_time)} hrs</p>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const handleTimelineClick = (tripItem) => {
    history(`/explore/${tractorId}/${tripItem.arrival_datetime}/${tripItem.to_arrival_datetime}`)

    onResetPlayback && onResetPlayback()

    onTripSelect && onTripSelect()
  }

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue)
  }

  return (
    <div className='view-metrics'>
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant='fullWidth'
        indicatorColor='primary'
        textColor='primary'
      >
        <Tab label='Trip Metrics' />
        <Tab label='Driver Profile' />
        <Tab label='Vehicle Details' />
        <Tab label='Tractor Timeline' />
        {isAtStop && <Tab label='Stop Metrics' />}
      </Tabs>
      <TabPanel value={activeTab} index={0}>
        <div className='trip-metrics'>
          <p>Distance Driven: {metrics.distanceDriven.toFixed(2)} miles</p>
          <p>Time Taken: {formatTime(metrics.timeTaken)} minutes</p>
          <p>Amount Spent: ${metrics.amountSpent.toFixed(2)}</p>
          <p> Total Dwell Time: {formatTime(metrics.totalDwellTime)} minutes</p>
          <p>Fuel Purchased: {metrics.fuelPurchased.toFixed(2)} gallons</p>
          <p>Fuel Consumed: {metrics.fuelConsumed.toFixed(2)} gallons</p>
          <p>Miles Per Gallon: {metrics.milesPerGallon}</p>
          <p>Fuel Tank Level:</p>
          <Box display='flex' alignItems='center'>
            <Box width='100%' mr={1}>
              <LinearProgress
                variant='determinate'
                value={metrics.fuelLevel}
                sx={{
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: getFuelBarColor(metrics.fuelLevel),
                  },
                  backgroundColor: '#ddd',
                  borderRadius: '5px',
                  height: '10px',
                  width: '100%'
                }}
              />
            </Box>
            <Box minWidth={35}>
              <Typography variant="body2" color="textSecondary">{metrics.fuelLevel.toFixed(2)}%</Typography>
            </Box>
          </Box>
        </div>
      </TabPanel>
      <TabPanel value={activeTab} index={1}>
        <div className='driver-profile'>
          <p>Name: John Smith</p>
          <p>ID: K3824739</p>
          <p>Licence Type: CDL Class A</p>
          <p>Safety Score: 89 </p>
          <p>Total Driving Hours: 156 hrs</p>
          <p>Average Idle Time per Trip: 2.6 hrs</p>
        </div>
      </TabPanel>
      <TabPanel value={activeTab} index={2}>
        <div className='vehicle-details'>
          <p>VIN: 1HGCM82633A123456</p>
          <p>Make and Model: Freightliner Cascadia</p>
          <p>Year: 2017</p>
          <p>Fuel Efficiency: 7.6 MPG</p>
          <p>Total Distance Travelled: 2878 miles</p>
          <p>Average Idle Time: 7.5 hrs</p>
        </div>
      </TabPanel>
      <TabPanel value={activeTab} index={3}>
        {renderTractorTimeline()}
      </TabPanel>
      {
        isAtStop && (
          <TabPanel value={activeTab} index={4}>
            <div className='stop-metrics'>
              <p>Arrival Time: {stopMetrics.arrivalTime.toLocaleString()}</p>
              <p>Departure Time: {stopMetrics.departureTime.toLocaleString()}</p>
              <p>Dwell Time: {formatTime(stopMetrics.dwellTime)}</p>
              <p>Miles From Last Stop: {stopMetrics.milesFromLastStop.toFixed(2)} miles</p>
              <p>Fuel Level Before Stop</p>
              <Box display='flex' alignItems='center'>
                <Box width='100%' mr={1}>
                  <LinearProgress
                    variant='determinate'
                    value={stopMetrics.fuelBeforeStop}
                    sx={{
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: getFuelBarColor(stopMetrics.fuelBeforeStop),
                      },
                      backgroundColor: '#ddd',
                      borderRadius: '5px',
                      height: '10px',
                      width: '100%'
                    }}
                  />
                </Box>
                <Box minWidth={35}>
                  <Typography variant="body2" color="textSecondary">{stopMetrics.fuelBeforeStop.toFixed(2)}%</Typography>
                </Box>
              </Box>
              <p>Fuel Level After Stop</p>
              <Box display='flex' alignItems='center'>
                <Box width='100%' mr={1}>
                  <LinearProgress
                    variant='determinate'
                    value={stopMetrics.fuelAfterStop}
                    sx={{
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: getFuelBarColor(stopMetrics.fuelAfterStop),
                      },
                      backgroundColor: '#ddd',
                      borderRadius: '5px',
                      height: '10px'
                    }}
                  />
                </Box>
                <Box minWidth={35}>
                  <Typography variant="body2" color="textSecondary">{stopMetrics.fuelAfterStop.toFixed(2)}%</Typography>
                </Box>
              </Box>
              {isFuelStop && (
                <>
                  <p>Location Name: {stopMetrics.locationName}</p>
                  <p>Unit Price: ${stopMetrics.unitPrice.toFixed(2)}</p>
                  <p>Total Cost: ${stopMetrics.totalCost.toFixed(2)}</p>
                  <p>Quantity: {stopMetrics.quantity.toFixed(2)} gallons</p>
                  <p>City: {stopMetrics.city}</p>
                  <p>State: {stopMetrics.state}</p>
                </>
              )}
            </div>
          </TabPanel>
        )
      }
    </div >
  )
}

const TabPanel = ({ children, value, index }) => (
  <div role='tabpanel' hidden={value !== index}>
    {value === index && (
      <Box p={2}>
        {children}
      </Box>
    )}
  </div>
)

export default ViewMetric