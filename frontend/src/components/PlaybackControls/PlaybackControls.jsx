import React, { useState, useEffect } from 'react'
import { IconButton, Slider } from '@mui/material'
import { PlayArrow, Pause, SkipNext, SkipPrevious, Replay } from '@mui/icons-material'
import PinBase from '../../assets/location-pin-solid'
import { icons } from '../../constants'
import './PlaybackControls.css'

const PlaybackControls = ({ totalDrivePoints, onPositionChange, stopIndices, animationSpeed, examineStop, stops, drivePoints }) => {
  const [position, setPosition] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [percentage, setPercentage] = useState('0.00')

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

  const marks = stops.map((stop) => {
    const index = drivePoints.findIndex((point) => point['time'] === stop.departure_datetime)

    const percentage = (index / (totalDrivePoints - 1)) * 100
    const IconComponent = getMarkerIcon(stop.type_new)

    return {
      value: percentage,
      label: (
        <div className='custom-marker-1'>
          <div className='pin-base-1'>
            <PinBase
              fill={getMarkerColor(stop.type_new)}
            />
            <div className='pin-icon-1'>
              {IconComponent &&
                <IconComponent
                  fill={getIconColor(stop.type_new)}
                />}
            </div>
          </div>
        </div>
      )
    }
  })

  useEffect(() => {
    const newPercentage = ((position / (totalDrivePoints - 1)) * 100).toFixed(2)
    setPercentage(newPercentage)
    onPositionChange(position)
  }, [position])

  const handleSliderChange = (event, value) => {
    const newPosition = Math.round((value / 100) * (totalDrivePoints - 1))
    setPosition(newPosition)
  }

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleNext = () => {
    const nextStopPosition = stopIndices.find((index) => index > position)
    if (nextStopPosition !== undefined) {
      setPosition(nextStopPosition)
    } else {
      setPosition(totalDrivePoints - 1)
    }
  }

  const handlePrevious = () => {
    const previousStops = stopIndices.filter((index) => index < position)
    const previousStopPosition = previousStops[previousStops.length - 1]
    if (previousStopPosition !== undefined) {
      setPosition(previousStopPosition)
    } else {
      setPosition(0)
    }
  }

  useEffect(() => {
    let intervalId
    if (isPlaying) {
      intervalId = setInterval(() => {
        setPosition((prev) => {
          if (prev < totalDrivePoints - 1) {
            return prev + 1
          } else {
            setIsPlaying(false)
            return prev
          }
        })
      }, 30 / animationSpeed) // 100ms Adjust this value to change playback speed
    }
    return () => clearInterval(intervalId)
  }, [isPlaying, animationSpeed])

  useEffect(() => {
    if (!isPlaying) return

    if (stopIndices.includes(position)) {
      setIsPlaying(false)
      const timeoutId = setTimeout(() => {
        setIsPlaying(true)
      }, 1000 / animationSpeed) // 1s Adjust this value to change stop duration
      return () => clearTimeout(timeoutId)
    }
  }, [position])

  return (
    <div className='playback-controls'>
      <div className='buttons'>
        <IconButton onClick={handlePrevious}>
          <SkipPrevious />
        </IconButton>
        <IconButton onClick={handlePlayPause} disabled={examineStop}>
          {isPlaying ? <Pause /> : <PlayArrow />}
        </IconButton>
        <IconButton onClick={handleNext}>
          <SkipNext />
        </IconButton>
        <IconButton onClick={() => setPosition(0)}>
          <Replay />
        </IconButton>
      </div>
      <div className='slider'>
        <Slider
          marks={marks}
          value={parseFloat(percentage)}
          onChange={handleSliderChange}
          min={0}
          max={100}
          step={0.01}
          valueLabelDisplay='auto'
        />
        <span style={{ marginLeft: '20px', marginRight: '20px' }}>{percentage}%</span>
      </div>
    </div>
  )
}

export default PlaybackControls