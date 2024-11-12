import React, { useState, useEffect} from 'react'

const ViewMetric = ({ trips, stops, currentPostion}) => {
  const [metrics, setMetrics] = useState({
    distanceDriven: 0,
    fuelLevel: 100,
    totalDwellTime: 0,
    amountSpent: 0,
    fuelPurchased: 0,
    fuelConsumed: 0,
    milesPerGallon: 0
  })

  // useEffect(() => {
  //   const newMetrics = calculateMetrics(trips, stops, currentPostion)
  //   setMetrics(newMetrics)
  // }, [trips, stops, currentPostion])

  // const calculateMetrics = (trips, stops, currentPostion) => {
  // }
  return (
    <div className='view-metrics'>
      <h3>Trip Metrics</h3>
      <p>Distance Driven: {metrics.distanceDriven.toFixed(2)} miles</p>
      <p>Fuel Level: {metrics.fuelLevel.toFixed(2)}%</p>
      <p>Amount Spent: ${metrics.amountSpent.toFixed(2)}</p>
      <p> Total Dwell Time: {metrics.totalDwellTime} minutes</p>
      <p>Fuel Purchased: {metrics.fuelPurchased.toFixed(2)} gallons</p>
      <p>Fuel Consumed: {metrics.fuelConsumed.toFixed(2)} gallons</p>
      <p>Miles Per Gallon: {metrics.milesPerGallon.toFixed(2)}</p>
    </div>
  )
}

export default ViewMetric