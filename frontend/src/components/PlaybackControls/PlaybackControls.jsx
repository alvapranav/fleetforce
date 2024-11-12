import React, { useState, useEffect } from 'react'
import { IconButton, Slider } from '@mui/material'
import { PlayArrow, Pause, SkipNext, SkipPrevious, Replay } from '@mui/icons-material'

const PlaybackControls = ({ stops, onPositionChange }) => {
  const [position, setPosition] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [intervalId, setIntervalId] = useState(null)

  const totalStops = stops.length

  useEffect(() => {
    let animationFrame

    if (isPlaying) {
      const animate = () => {
        setPosition((prev) => {
          if (prev + 1 > totalStops) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
        animationFrame = setTimeout(animate, 2000)
      }
      animate()

      return () => clearTimeout(animationFrame)
    }
  }, [isPlaying])

  useEffect(() => {
    onPositionChange(position)
  }, [position])

  const handleSliderChange = (event, newValue) => {
    setPosition(newValue)
  }

  const handleNext = () => {
    setPosition((prev) => Math.min(prev + 1, totalStops))
  }
  // const closestStop = position [Implement this function]

  return (
    <div className='playback-controls'>
      <div className='buttons'>
        <IconButton onClick={() => setPosition((p) => Math.max(p - 1, 0))}>
          <SkipPrevious />
        </IconButton>
        <IconButton onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? <Pause /> : <PlayArrow />}
        </IconButton>
        <IconButton onClick={() => setPosition((p) => Math.min(p + 1, totalStops))}>
          <SkipNext />
        </IconButton>
        <IconButton onClick={() => setPosition(0)}>
          <Replay />
        </IconButton>
        </div>
        <Slider
          value={position}
          onChange={(e, val) => setPosition(val)}
          min={0}
          max={totalStops}
          valueLabelDisplay='auto'
        />
    </div>
      )
}

      export default PlaybackControls