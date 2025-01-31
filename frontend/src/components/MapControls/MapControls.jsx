import React from 'react'
import { Select, MenuItem, Button, Slider, Typography } from '@mui/material'

const MapControls = ({ onChangeMapStyle, onExamineStop, examineStop, isAtStop, onToggleHeatmap, onAnimationSpeedChange, animationSpeed }) => {
  return (
    <div className='map-controls'>
      {/* <h4 variant='h4'>Map Controls</h4> */}
      <Select defaultValue="https://api.maptiler.com/maps/basic-v2/style.json?key=oGOTJkyBZPxrLa145LN6" onChange={(e) => onChangeMapStyle(e.target.value)} disabled={examineStop}>
        <MenuItem value="https://api.maptiler.com/maps/basic-v2/style.json?key=oGOTJkyBZPxrLa145LN6">Basic</MenuItem>
        <MenuItem value="https://api.maptiler.com/maps/satellite/style.json?key=oGOTJkyBZPxrLa145LN6">Satellite</MenuItem>
        <MenuItem value="https://api.maptiler.com/maps/backdrop/style.json?key=oGOTJkyBZPxrLa145LN6">Backdrop</MenuItem>
      </Select>
      {/* <h4 variant='h4'>Heatmap</h4> */}
      <Select
        defaultValue="Speed" onChange={(e) => onToggleHeatmap(e.target.value)}
      >
        <MenuItem value="Speed">Speed</MenuItem>
        <MenuItem value="Mileage">MPG</MenuItem>
      </Select>
      <Button
        onClick={onExamineStop}
        disabled={!isAtStop}
      >{examineStop ? 'View Route' : 'Examine Stop'}</Button>
      {/* <h4>Animation Speed:</h4> */}
      <Slider
        value={animationSpeed}
        min={0.5}
        max={5}
        step={0.1}
        onChange={(e, val) => onAnimationSpeedChange(val)}
        valueLabelDisplay='auto'
      />

    </div>
  )
}

export default MapControls