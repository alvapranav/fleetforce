import { Tabs, Tab, LinearProgress, Box, Typography } from '@mui/material'
import React, { useState, useEffect } from 'react'

const ViewMetric = ({ currentPosition, drivePoints, unitTank, stops, stopIndices, isAtStop }) => {
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

  const [isFuelStop, setIsFuelStop] = useState(false)

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
      {
        isAtStop && (
          <TabPanel value={activeTab} index={3}>
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