import React, { useState, useEffect } from 'react'
import { IconButton, Slider } from '@mui/material'
import { PlayArrow, Pause, SkipNext, SkipPrevious, Replay } from '@mui/icons-material'
import './PlaybackControls.css'

const PlaybackControls = ({ totalDrivePoints, onPositionChange, stopIndices }) => {
  const [position, setPosition] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [percentage, setPercentage] = useState('0.00')

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
        }, 10) // 100ms Adjust this value to change playback speed
      }
      return () => clearInterval(intervalId)
    }, [isPlaying])

    useEffect(() => {
      if (!isPlaying) return
    
      if(stopIndices.includes(position)) {
        setIsPlaying(false)
        const timeoutId = setTimeout(() => {
          setIsPlaying(true)
        }, 500) // 1s Adjust this value to change stop duration
        return () => clearTimeout(timeoutId)
      }
    }, [position])

    return (
      <div className='playback-controls'>
        <div className='buttons'>
          <IconButton onClick={handlePrevious}>
            <SkipPrevious />
          </IconButton>
          <IconButton onClick={handlePlayPause}>
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
            value={parseFloat(percentage)}
            onChange={handleSliderChange}
            min={0}
            max={100}
            step={0.01}
            valueLabelDisplay='auto'
          />
          <span style={{ marginLeft: '20px', marginRight: '20px'}}>{percentage}%</span>
        </div>
      </div>
    )
  }

  export default PlaybackControls