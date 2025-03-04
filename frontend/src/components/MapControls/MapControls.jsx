import React from 'react'
import { Select, MenuItem, Button, Slider } from '@mui/material'
import './MapControls.css'

const MapControls = ({ onChangeMapStyle, onExamineStop, examineStop, isAtStop, onToggleHeatmap, onAnimationSpeedChange, animationSpeed, unitTank, onToggleWeather, weatherOption }) => {
  return (
    <div className='map-controls'>
      <h4>Map Controls</h4>
      <div className='dropdowns'>
        <div className='dropdown-child'>
          <h5>Map Style:</h5>
          <Select defaultValue="https://api.maptiler.com/maps/basic-v2/style.json?key=oGOTJkyBZPxrLa145LN6" style={{ width: '100px', height: '30px' }} onChange={(e) => onChangeMapStyle(e.target.value)} disabled={examineStop}>
            <MenuItem value="https://api.maptiler.com/maps/basic-v2/style.json?key=oGOTJkyBZPxrLa145LN6">Basic</MenuItem>
            <MenuItem value="https://api.maptiler.com/maps/satellite/style.json?key=oGOTJkyBZPxrLa145LN6">Satellite</MenuItem>
            <MenuItem value="https://api.maptiler.com/maps/backdrop/style.json?key=oGOTJkyBZPxrLa145LN6">Backdrop</MenuItem>
          </Select>
        </div>
        <div className='dropdown-child'>
          <h5>Heatmap:</h5>
          <Select
            defaultValue="Speed" onChange={(e) => onToggleHeatmap(e.target.value)}
            style={{ width: '100px', height: '30px' }}
          >
            <MenuItem value="Speed">Speed</MenuItem>
            <MenuItem value="Mileage" disabled={!unitTank}>MPG</MenuItem>
          </Select>
        </div>
        <div className='dropdown-child'>
          <h5>Weather</h5>
          <Select
            value={weatherOption}
            style={{ width: '100px', height: '30px' }}
            onChange={(e) => onToggleWeather(e.target.value)}
          >
            <MenuItem value="None">None</MenuItem>
            <MenuItem value="precipitation_new">Rain</MenuItem>
            <MenuItem value="temp_new">Temp</MenuItem>
            <MenuItem value="wind_new">Wind</MenuItem>
            <MenuItem value="snow_new">Snow</MenuItem>
          </Select>
        </div>
      </div>
      <div className='other-controls'>
        <Button
          onClick={onExamineStop}
          disabled={!isAtStop}
          variant='contained'
          style={{ width: '120px', height: '40px', marginTop: '25px' }}
        >{examineStop ? 'View Route' : 'Examine Stop'}</Button>
        {/* <h4>Animation Speed:</h4> */}
        <div className='slider'>
          <h5>Animation Speed:</h5>
        <Slider
          value={animationSpeed}
          min={0.5}
          max={5}
          step={0.1}
          style={{ width: '100px' }}
          onChange={(e, val) => onAnimationSpeedChange(val)}
          valueLabelDisplay='auto'
        />
        </div>
      </div>
    </div>
  )
}

export default MapControls