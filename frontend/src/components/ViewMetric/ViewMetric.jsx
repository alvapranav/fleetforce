import React, { useState, useEffect } from 'react'

const ViewMetric = ({ currentPosition, drivePoints, unitTank, stops, stopIndices, isAtStop }) => {

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

        const stopPoint = stops[stopIndices.findIndex((index) => index === i+1)]

        if (stopPoint) {
          totalDwellTime += stopPoint.dwell_time / 60
          fuelPurchased += stopPoint.quantity
          amountSpent += stopPoint.total_cost
          if (stopPoint.type_new == 'fuel' || stopPoint.type_new == 'fuel_ext') {
            fuelConsumed += (drivePoints[fuel_index].fuel - stopPoint.fuel_tank_percent_before) * unitTank
            fuel_index = i+1
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
        const fuelBeforeStop = stopPoint.fuel_tank_percent_before
        const fuelAfterStop = stopPoint.fuel_tank_percent_after
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
          fuelLevel: drivePoints[currentPosition].fuel,
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
  return (
    <div className='view-metrics'>
      <div className='trip-metrics'>
      <h3>Trip Metrics</h3>
      <p>Distance Driven: {metrics.distanceDriven.toFixed(2)} miles</p>
      <p>Time Taken: {metrics.timeTaken.toFixed(2)} minutes</p>
      <p>Fuel Level: {metrics.fuelLevel.toFixed(2)}%</p>
      <p>Amount Spent: ${metrics.amountSpent.toFixed(2)}</p>
      <p> Total Dwell Time: {metrics.totalDwellTime.toFixed(2)} minutes</p>
      <p>Fuel Purchased: {metrics.fuelPurchased.toFixed(2)} gallons</p>
      <p>Fuel Consumed: {metrics.fuelConsumed.toFixed(2)} gallons</p>
      <p>Miles Per Gallon: {metrics.milesPerGallon}</p>
      </div>
      {isAtStop && (
        <div className='stop-metrics'>
          <h3>Stop Metrics</h3>
          <p>Arrival Time: {stopMetrics.arrivalTime.toLocaleString()}</p>
          <p>Departure Time: {stopMetrics.departureTime.toLocaleString()}</p>
          <p>Dwell Time: {stopMetrics.dwellTime.toFixed(2)} minutes</p>
          <p>Miles From Last Stop: {stopMetrics.milesFromLastStop.toFixed(2)} miles</p>
          <p>Fuel Before Stop: {stopMetrics.fuelBeforeStop.toFixed(2)}%</p>
          <p>Fuel After Stop: {stopMetrics.fuelAfterStop.toFixed(2)}%</p>
            {isFuelStop &&(
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
      )}
    </div>
  )
}

export default ViewMetric