import React from 'react'
import { Select, MenuItem, Button } from '@mui/material'

const MapControls = ({ stops, onChangeMapStyle, onExamineStop, onToggleHeatmap }) => {
  return (
    <div className='map-controls'>
      <Select defaultValue="https://api.maptiler.com/maps/basic-v2/style.json?key=oGOTJkyBZPxrLa145LN6" on onChange={(e) => onChangeMapStyle(e.target.value)}>
        <MenuItem value="https://api.maptiler.com/maps/basic-v2/style.json?key=oGOTJkyBZPxrLa145LN6">Basic</MenuItem>
        <MenuItem value="https://api.maptiler.com/maps/satellite/style.json?key=oGOTJkyBZPxrLa145LN6">Satellite</MenuItem>
        <MenuItem value="https://api.maptiler.com/maps/backdrop/style.json?key=oGOTJkyBZPxrLa145LN6">Backdrop</MenuItem>
      </Select>
      <Select defaultValue="Speed" on onChange={(e) => onToggleHeatmap(e.target.value)}>
        <MenuItem value="Speed">Speed</MenuItem>
        <MenuItem value="Mileage">Mileage</MenuItem>
      </Select>
      <Button onClick={(e) => onExamineStop(e)}>Examine Stop</Button>
    </div>
  )
}

export default MapControls