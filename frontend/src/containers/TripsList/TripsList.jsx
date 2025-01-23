import React, { useState, useEffect } from 'react'
import {
    TextField,
    Button,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TablePagination
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

// Helper to convert distance in meters to miles
const metersToMiles = (m) => {
    if (!m) return '';
    const miles = m * 0.000621371;
    return miles.toFixed(2);  // e.g. "12.35"
};

// Helper to convert time in seconds to "X days, Y.Z hours" or just "Y.Z hours" if < 24 hours
const formatTimeTaken = (seconds) => {
    if (!seconds || seconds <= 0) return '';
    let days = Math.floor(seconds / 86400);
    let remainder = seconds % 86400;
    let hrs = remainder / 3600.0;

    if (days > 0) {
        return `${days} day(s), ${hrs.toFixed(1)} hr(s)`;
    } else {
        return `${hrs.toFixed(1)} hr(s)`;
    }
};

// Convert dwell seconds to hours
const formatDwellHours = (seconds) => {
    if (!seconds || seconds <= 0) return '';
    const hrs = seconds / 3600;
    return hrs.toFixed(2); // e.g. "3.45"
};

// Format dollar value
const formatDollar = (amt) => {
    if (!amt) return '';
    return `$${amt.toFixed(2)}`;
};

const TripsList = () => {
    const [trips, setTrips] = useState([]);
    const [filteredTrips, setFilteredTrips] = useState([]);
    const [filters, setFilters] = useState({
        tripId: '',
        tractorId: '',
        startDate: '',
        endDate: '',
    });
    const [page, setPage] = useState(0);
    const [rowsPerPage] = useState(10);
    const history = useNavigate();

    useEffect(() => {
        const fetchTrips = async () => {
            try {
                const response = await axios.get('/api/trips');
                setTrips(response.data);
                setFilteredTrips(response.data);
            }
            catch (error) {
                console.error('Error fetching trips', error);
            }
        };
        fetchTrips();
    }, []);

    const handleFilterChange = (e) => {
        setFilters({
            ...filters,
            [e.target.name]: e.target.value,
        });
    };

    const applyFilters = () => {
        let filtered = [...trips];

        if (filters.tripId) {
            filtered = filtered.filter((trip) =>
                trip.trip_ref_norm && trip.trip_ref_norm.includes(filters.tripId)
            );
        }
        if (filters.tractorId) {
            filtered = filtered.filter((trip) =>
                trip.tractor_id && trip.tractor_id.includes(filters.tractorId)
            );
        }
        if (filters.startDate) {
            filtered = filtered.filter((trip) =>
                new Date(trip.arrival_datetime) >= new Date(filters.startDate)
            );
        }
        if (filters.endDate) {
            filtered = filtered.filter((trip) =>
                new Date(trip.to_arrival_datetime) <= new Date(filters.endDate)
            );
        }

        setFilteredTrips(filtered);
        setPage(0);
    };

    const handleExplore = (trip) => {
        // e.g. navigate to route explorer
        history(`/explore/${trip.tractor_id}/${trip.arrival_datetime}/${trip.to_arrival_datetime}`);
    };

    // Pagination handlers
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    // Slice rows for pagination
    const currentRows = filteredTrips.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
        <div>
            <h1>Trip List</h1>
            <div className='filters' style={{ marginBottom: '1rem' }}>
                <TextField
                    name='tripId'
                    label='Trip ID'
                    value={filters.tripId}
                    onChange={handleFilterChange}
                    variant='outlined'
                    size='small'
                    style={{ marginRight: '10px' }}
                />
                <TextField
                    name='tractorId'
                    label='Tractor ID'
                    value={filters.tractorId}
                    onChange={handleFilterChange}
                    variant='outlined'
                    size='small'
                    style={{ marginRight: '10px' }}
                />
                <TextField
                    name='startDate'
                    label='Start Date'
                    type='date'
                    InputLabelProps={{ shrink: true }}
                    value={filters.startDate}
                    onChange={handleFilterChange}
                    variant='outlined'
                    size='small'
                    style={{ marginRight: '10px' }}
                />
                <TextField
                    name='endDate'
                    label='End Date'
                    type='date'
                    InputLabelProps={{ shrink: true }}
                    value={filters.endDate}
                    onChange={handleFilterChange}
                    variant='outlined'
                    size='small'
                    style={{ marginRight: '10px' }}
                />
                <Button
                    variant='contained'
                    color='primary'
                    onClick={applyFilters}
                >
                    Apply Filters
                </Button>
            </div>

            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Action</TableCell>
                        <TableCell>Trip ID</TableCell>
                        <TableCell>Tractor ID</TableCell>
                        <TableCell>Origin City</TableCell>
                        <TableCell>Origin State</TableCell>
                        <TableCell>Destination City</TableCell>
                        <TableCell>Destination State</TableCell>
                        <TableCell>Departure Date</TableCell>
                        <TableCell>Arrival Date</TableCell>
                        <TableCell>Distance (mi)</TableCell>
                        <TableCell>Time Taken</TableCell>
                        <TableCell>Total Stops</TableCell>
                        <TableCell>Fuel Stops</TableCell>
                        <TableCell>Short Stops</TableCell>
                        <TableCell>Long Stops</TableCell>
                        <TableCell>Dwell (hrs)</TableCell>
                        <TableCell>Fuel (gal)</TableCell>
                        <TableCell>Fuel ($)</TableCell>
                    </TableRow>
                </TableHead>

                <TableBody>
                    {currentRows.map((trip) => {
                        const rowKey = `${trip.trip_ref_norm}_${trip.arrival_datetime}`;
                        const distMiles = metersToMiles(trip.distance_travelled);
                        const timeStr = formatTimeTaken(trip.time_taken);
                        const dwellHrs = formatDwellHours(trip.total_dwell_time);
                        const dollarFuel = trip.dollar_fuel_purchased ? parseFloat(trip.dollar_fuel_purchased) : 0;

                        return (
                            <TableRow
                                key={rowKey}
                                style={{ cursor: 'default' }}
                            >
                                <TableCell>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={() => handleExplore(trip)}
                                    >
                                        Explore
                                    </Button>
                                </TableCell>
                                <TableCell>{trip.trip_ref_norm}</TableCell>
                                <TableCell>{trip.tractor_id}</TableCell>
                                <TableCell>{trip.city}</TableCell>
                                <TableCell>{trip.state}</TableCell>
                                <TableCell>{trip.to_city}</TableCell>
                                <TableCell>{trip.to_state}</TableCell>
                                <TableCell>{trip.arrival_datetime}</TableCell>
                                <TableCell>{trip.to_arrival_datetime}</TableCell>
                                <TableCell>{distMiles}</TableCell>
                                <TableCell>{timeStr}</TableCell>
                                <TableCell>{trip.total_stops || 0}</TableCell>
                                <TableCell>{trip.total_fuel_stops || 0}</TableCell>
                                <TableCell>{trip.total_short_stops || 0}</TableCell>
                                <TableCell>{trip.total_long_stops || 0}</TableCell>
                                <TableCell>{dwellHrs}</TableCell>
                                <TableCell>{trip.volume_fuel_purchased || 0}</TableCell>
                                <TableCell>{formatDollar(dollarFuel)}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>

            <TablePagination
                component='div'
                count={filteredTrips.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[]}
            />
        </div>
    );
};

export default TripsList;