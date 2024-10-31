import React from 'react'
import { Box, Grid2, Typography } from '@mui/material'
import { ViewMetric, ViewRoute, PlaybackControls, MapControls } from '../../components'
import './ExploreRoute.css'


const ExploreRoute = ({tripId, arrivalDate}) => {
  return (
    <Box p={2}>
        <Typography variant="h4" gutterBottom>
            Trip #{tripId} - Tractor
        </Typography>
        <Grid2 container spacing={2}>
            {/* Left Side: Mappying Visualization */}
            <Grid2 item xs={9}>
                <ViewRoute tripId={tripId} arrivalDate={arrivalDate} />
                {/* Playback Controls */}
                <PlaybackControls tripId={tripId} arrivalDate={arrivalDate} />
            </Grid2>

            {/* Right Side: Metrics and Controls*/}
            <Grid2 item xs={3}>
                <ViewMetric tripId={tripId} arrivalDate={arrivalDate} />
                <MapControls />
            </Grid2>

        </Grid2>
    </Box>
  )
}

export default ExploreRoute