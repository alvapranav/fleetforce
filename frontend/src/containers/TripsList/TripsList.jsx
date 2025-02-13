import React, { useState, useEffect } from 'react'
import {
    TextField,
    Button,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TablePagination,
    Autocomplete,
    Slider
} from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import './TripsList.css'

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

// Format float
const formatFloat = (num) => {
    if (!num) return '';
    return num.toFixed(2);
}

const TripsList = () => {
    const [trips, setTrips] = useState([]);
    const [filteredTrips, setFilteredTrips] = useState([]);
    const [filters, setFilters] = useState({
        tractorId: '',
        startDate: '',
        endDate: '',
        minDistance: '',
        maxDistance: '',
        minDwell: '',
        maxDwell: '',
        minFuelSpend: '',
        maxFuelSpend: '',
        minFuelIdle: '',
        maxFuelIdle: '',
        minStops: '',
        maxStops: '',
        minMpg: '',
        maxMpg: '',
    });
    const [appliedFilters, setAppliedFilters] = useState({
        tractorId: '',
        startDate: '',
        endDate: '',
        minDistance: '',
        maxDistance: '',
        minDwell: '',
        maxDwell: '',
        minFuelSpend: '',
        maxFuelSpend: '',
        minFuelIdle: '',
        maxFuelIdle: '',
        minStops: '',
        maxStops: '',
        minMpg: '',
        maxMpg: '',
    });
    const [filterRanges, setFilterRanges] = useState({
        distance: [0, 0],
        dwell: [0, 0],
        fuelSpend: [0, 0],
        fuelIdle: [0, 0],
        stops: [0, 0],
        mpg: [0, 0],
    });
    const [page, setPage] = useState(0);
    const [rowsPerPage] = useState(10);
    const [allTractorIDs, setAllTractorIDs] = useState([]);
    const [selectedTractorIDs, setSelectedTractorIDs] = useState([]);
    const [minDate, setMinDate] = useState(null);
    const [maxDate, setMaxDate] = useState(null);
    const history = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const fetchTrips = async () => {
            try {
                const response = await axios.get('/api/trips');
                const data = response.data;
                setTrips(data);
                setFilteredTrips(data);

                // Gather unique Tractor IDs
                const uniqueTractorIds = [...new Set(data.map(t => t.tractor_id).filter(Boolean))];
                setAllTractorIDs(uniqueTractorIds);

                if (data.length > 0) {
                    let earliest = null;
                    let latest = null;
                    let minDistance = Number.POSITIVE_INFINITY, maxDistance = 0;
                    let minDwell = Number.POSITIVE_INFINITY, maxDwell = 0;
                    let minFuelSpend = Number.POSITIVE_INFINITY, maxFuelSpend = 0;
                    let minFuelIdle = Number.POSITIVE_INFINITY, maxFuelIdle = 0;
                    let minStops = Number.POSITIVE_INFINITY, maxStops = 0;
                    let minMpg = Number.POSITIVE_INFINITY, maxMpg = 0;


                    data.forEach(trip => {
                        const dep = trip.arrival_datetime ? new Date(trip.arrival_datetime) : null;
                        const arr = trip.to_arrival_datetime ? new Date(trip.to_arrival_datetime) : null;
                        if (dep && (!earliest || dep < earliest)) {
                            earliest = dep;
                        }
                        if (arr && (!latest || arr > latest)) {
                            latest = arr;
                        }
                        if (metersToMiles(trip.distance_travelled) < minDistance) minDistance = Number(metersToMiles(Math.floor(trip.distance_travelled)));
                        if (metersToMiles(trip.distance_travelled) > maxDistance) maxDistance = Number(metersToMiles(Math.ceil(trip.distance_travelled)));
                        if (formatDwellHours(trip.total_dwell_time) < minDwell) minDwell = Number(formatDwellHours(Math.floor(trip.total_dwell_time)));
                        if (formatDwellHours(trip.total_dwell_time) > maxDwell) maxDwell = Number(formatDwellHours(Math.ceil(trip.total_dwell_time)));
                        if (trip.dollar_fuel_purchased < minFuelSpend) minFuelSpend = Number(trip.dollar_fuel_purchased);
                        if (trip.dollar_fuel_purchased > maxFuelSpend) maxFuelSpend = Number(trip.dollar_fuel_purchased);
                        if (trip.fuel_burned_idling < minFuelIdle) minFuelIdle = Number(trip.fuel_burned_idling);
                        if (trip.fuel_burned_idling > maxFuelIdle) maxFuelIdle = Number(trip.fuel_burned_idling);
                        if (trip.total_stops < minStops) minStops = Number(trip.total_stops);
                        if (trip.total_stops > maxStops) maxStops = Number(trip.total_stops);
                        if (trip.mpg < minMpg) minMpg = Number(trip.mpg);
                        if (trip.mpg > maxMpg) maxMpg = Number(trip.mpg);
                    })

                    setMinDate(earliest);
                    setMaxDate(latest);
                    setFilterRanges({
                        distance: [minDistance, maxDistance],
                        dwell: [minDwell, maxDwell],
                        fuelSpend: [minFuelSpend, maxFuelSpend],
                        fuelIdle: [minFuelIdle, maxFuelIdle],
                        stops: [minStops, maxStops],
                        mpg: [minMpg, maxMpg],
                    });

                    let newStart = earliest ? earliest.toISOString().split('T')[0] : '';
                    let newEnd = latest ? latest.toISOString().split('T')[0] : '';

                    setFilters(prev => ({
                        ...prev,
                        startDate: newStart,
                        endDate: newEnd,
                        minDistance: minDistance,
                        maxDistance: maxDistance,
                        minDwell: minDwell,
                        maxDwell: maxDwell,
                        minFuelSpend: minFuelSpend,
                        maxFuelSpend: maxFuelSpend,
                        minFuelIdle: minFuelIdle,
                        maxFuelIdle: maxFuelIdle,
                        minStops: minStops,
                        maxStops: maxStops,
                        minMpg: minMpg,
                        maxMpg: maxMpg,
                    }))
                    setAppliedFilters(prev => ({
                        ...prev,
                        startDate: newStart,
                        endDate: newEnd,
                        minDistance: minDistance,
                        maxDistance: maxDistance,
                        minDwell: minDwell,
                        maxDwell: maxDwell,
                        minFuelSpend: minFuelSpend,
                        maxFuelSpend: maxFuelSpend,
                        minFuelIdle: minFuelIdle,
                        maxFuelIdle: maxFuelIdle,
                        minStops: minStops,
                        maxStops: maxStops,
                        minMpg: minMpg,
                        maxMpg: maxMpg,
                    }))
                }
                // else {
                //     setFilters(prev => ({
                //         ...prev,
                //         startDate: '',
                //         endDate: '',

                //     }))
                //     setAppliedFilters(prev => ({
                //         ...prev,
                //         startDate: '',
                //         endDate: '',
                //     }))
                // }

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

        if (Array.isArray(filters.tractorId) && filters.tractorId.length > 0) {
            filtered = filtered.filter((trip) => trip.tractor_id && filters.tractorId.includes(trip.tractor_id));
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
        if (filters.minDistance) {
            filtered = filtered.filter((trip) =>
                metersToMiles(trip.distance_travelled) >= filters.minDistance
            );
        }
        if (filters.maxDistance) {
            filtered = filtered.filter((trip) =>
                metersToMiles(trip.distance_travelled) <= filters.maxDistance
            );
        }
        if (filters.minDwell) {
            filtered = filtered.filter((trip) =>
                formatDwellHours(trip.total_dwell_time) >= filters.minDwell
            );
        }
        if (filters.maxDwell) {
            filtered = filtered.filter((trip) =>
                formatDwellHours(trip.total_dwell_time) <= filters.maxDwell
            );
        }
        if (filters.minFuelSpend) {
            filtered = filtered.filter((trip) =>
                trip.dollar_fuel_purchased >= filters.minFuelSpend
            );
        }
        if (filters.maxFuelSpend) {
            filtered = filtered.filter((trip) =>
                trip.dollar_fuel_purchased <= filters.maxFuelSpend
            );
        }
        if (filters.minFuelIdle) {
            filtered = filtered.filter((trip) =>
                trip.fuel_burned_idling >= filters.minFuelIdle
            );
        }
        if (filters.maxFuelIdle) {
            filtered = filtered.filter((trip) =>
                trip.fuel_burned_idling <= filters.maxFuelIdle
            );
        }
        if (filters.minStops) {
            filtered = filtered.filter((trip) =>
                trip.total_stops >= filters.minStops
            );
        }
        if (filters.maxStops) {
            filtered = filtered.filter((trip) =>
                trip.total_stops <= filters.maxStops
            );
        }
        if (filters.minMpg) {
            filtered = filtered.filter((trip) =>
                trip.mpg >= filters.minMpg
            );
        }
        if (filters.maxMpg) {
            filtered = filtered.filter((trip) =>
                trip.mpg <= filters.maxMpg
            );
        }

        setFilteredTrips(filtered);
        setPage(0);

        setAppliedFilters(filters);
    };

    const resetFilters = () => {
        setSelectedTractorIDs([]);

        let startVal = minDate ? minDate.toISOString().split('T')[0] : '';
        let endVal = maxDate ? maxDate.toISOString().split('T')[0] : '';

        setFilters({
            tractorId: '',
            startDate: startVal,
            endDate: endVal,
            minDistance: filterRanges.distance[0],
            maxDistance: filterRanges.distance[1],
            minDwell: filterRanges.dwell[0],
            maxDwell: filterRanges.dwell[1],
            minFuelSpend: filterRanges.fuelSpend[0],
            maxFuelSpend: filterRanges.fuelSpend[1],
            minFuelIdle: filterRanges.fuelIdle[0],
            maxFuelIdle: filterRanges.fuelIdle[1],
            minStops: filterRanges.stops[0],
            maxStops: filterRanges.stops[1],
            minMpg: filterRanges.mpg[0],
            maxMpg: filterRanges.mpg[1],
        });
        setAppliedFilters({
            tractorId: '',
            startDate: startVal,
            endDate: endVal,
            minDistance: filterRanges.distance[0],
            maxDistance: filterRanges.distance[1],
            minDwell: filterRanges.dwell[0],
            maxDwell: filterRanges.dwell[1],
            minFuelSpend: filterRanges.fuelSpend[0],
            maxFuelSpend: filterRanges.fuelSpend[1],
            minFuelIdle: filterRanges.fuelIdle[0],
            maxFuelIdle: filterRanges.fuelIdle[1],
            minStops: filterRanges.stops[0],
            maxStops: filterRanges.stops[1],
            minMpg: filterRanges.mpg[0],
            maxMpg: filterRanges.mpg
        });
        setFilteredTrips(trips);
        setPage(0);

    };
    

    const handleExplore = (trip) => {
        // e.g. navigate to route explorer
        history(`/explore/${trip.tractor_id}/${trip.arrival_datetime}/${trip.to_arrival_datetime}`, {
            state: { filters: appliedFilters, currentPage: page },
        });
    };

    // Pagination handlers
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    // Slice rows for pagination
    const currentRows = filteredTrips.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const filtersChanged = JSON.stringify(appliedFilters) !== JSON.stringify(filters);

    return (
        <div>
            <div className='header'>
                <h1 className='heading'>Trip List</h1>
            </div>
            <div className='filters-row'
                style={{
                    marginBottom: '1rem',
                    marginLeft: '10px',
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '2rem',
                    alighItems: 'flex-end'
                }}>
                <Autocomplete
                    multiple
                    options={allTractorIDs}
                    value={selectedTractorIDs}
                    onChange={(event, newValue) => {
                        setSelectedTractorIDs(newValue);
                        setFilters((prev) => ({ ...prev, tractorId: newValue }))
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            variant='outlined'
                            label='Tractor ID'
                            size='small'
                            InputLabelProps={{ shrink: true }}
                            style={{ marginRight: '10px', width: '30vw' }}
                            placeholder={selectedTractorIDs.length === 0 ? 'All' :
                                selectedTractorIDs.length === 1 ? selectedTractorIDs[0] :
                                    `${selectedTractorIDs.length} selected`}
                        />
                    )}
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
                    style={{ marginRight: '10px', width: '12vw' }}
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
                    style={{ marginRight: '10px', width: '12vw' }}
                />
                <Button
                    variant='contained'
                    color='primary'
                    onClick={applyFilters}
                    disabled={!filtersChanged}
                >
                    Apply Filters
                </Button>
                <Button
                    variant='contained'
                    color='secondary'
                    onClick={resetFilters}
                >
                    Reset
                </Button>
            </div>
            <div className='slider-filters'
                style={{ display: 'flex', flexDirection: 'row', margin: '10px' }}
            >
                <div style={{ width: '250px', display: 'flex', flexDirection: 'column' }}>
                    <label style={{ color: '#6b6c6d', fontSize: '0.9rem' }}>Distance (mi)</label>
                    <Slider
                        min={filterRanges.distance[0]}
                        max={filterRanges.distance[1]}
                        value={[filters.minDistance, filters.maxDistance]}
                        onChange={(e) => setFilters((prev) => ({ ...prev, minDistance: Number(e.target.value[0]), maxDistance: Number(e.target.value[1]) }))}
                        valueLabelDisplay='auto'
                        style={{ width: '200px' }}
                    />
                </div>
                <div style={{ width: '250px', display: 'flex', flexDirection: 'column' }}>
                    <label style={{ color: '#6b6c6d', fontSize: '0.9rem' }}>Dwell (hrs)</label>
                    <Slider
                        min={filterRanges.dwell[0]}
                        max={filterRanges.dwell[1]}
                        value={[filters.minDwell, filters.maxDwell]}
                        onChange={(e) => setFilters((prev) => ({ ...prev, minDwell: e.target.value[0], maxDwell: e.target.value[1] }))}
                        valueLabelDisplay='auto'
                        style={{ width: '200px' }}
                    />
                </div>
                <div style={{ width: '250px', display: 'flex', flexDirection: 'column' }}>
                    <label style={{ color: '#6b6c6d', fontSize: '0.9rem' }}>Fuel Spend ($)</label>
                    <Slider
                        min={filterRanges.fuelSpend[0]}
                        max={filterRanges.fuelSpend[1]}
                        value={[filters.minFuelSpend, filters.maxFuelSpend]}
                        onChange={(e) => setFilters((prev) => ({ ...prev, minFuelSpend: e.target.value[0], maxFuelSpend: e.target.value[1] }))}
                        valueLabelDisplay='auto'
                        style={{ width: '200px' }}
                    />
                </div>
                <div style={{ width: '250px', display: 'flex', flexDirection: 'column' }}>
                    <label style={{ color: '#6b6c6d', fontSize: '0.9rem' }}>Fuel Burned Idle (gal)</label>
                    <Slider
                        min={filterRanges.fuelIdle[0]}
                        max={filterRanges.fuelIdle[1]}
                        value={[filters.minFuelIdle, filters.maxFuelIdle]}
                        onChange={(e) => setFilters((prev) => ({ ...prev, minFuelIdle: e.target.value[0], maxFuelIdle: e.target.value[1] }))}
                        valueLabelDisplay='auto'
                        style={{ width: '200px' }}
                    />
                </div>
                <div style={{ width: '250px', display: 'flex', flexDirection: 'column' }}>
                    <label style={{ color: '#6b6c6d', fontSize: '0.9rem' }}>Stops</label>
                    <Slider
                        min={filterRanges.stops[0]}
                        max={filterRanges.stops[1]}
                        value={[filters.minStops, filters.maxStops]}
                        onChange={(e) => setFilters((prev) => ({ ...prev, minStops: e.target.value[0], maxStops: e.target.value[1] }))}
                        valueLabelDisplay='auto'
                        style={{ width: '200px' }}
                    />
                </div>
                <div style={{ width: '250px', display: 'flex', flexDirection: 'column' }}>
                    <label style={{ color: '#6b6c6d', fontSize: '0.9rem' }}>MPG</label>
                    <Slider
                        min={filterRanges.mpg[0]}
                        max={filterRanges.mpg[1]}
                        value={[filters.minMpg, filters.maxMpg]}
                        onChange={(e) => setFilters((prev) => ({ ...prev, minMpg: e.target.value[0], maxMpg: e.target.value[1] }))}
                        valueLabelDisplay='auto'
                        style={{ width: '200px' }}
                    />
                </div>
            </div>
            {/* <Table style={{ width: '100%', tableLayout: 'fixed' }}> */}
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Action</TableCell>
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
                        <TableCell>Fuel Purchased (gal)</TableCell>
                        <TableCell>Fuel Purchased ($)</TableCell>
                        <TableCell>Fuel Burned Driving (gal)</TableCell>
                        <TableCell>Fuel Burned Idle (gal)</TableCell>
                        <TableCell>Fuel Efficiency (mpg)</TableCell>
                    </TableRow>
                </TableHead>

                <TableBody>
                    {currentRows.map((trip) => {
                        const rowKey = `${trip.trip_id}_${trip.arrival_datetime}`;
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
                                <TableCell>{formatDollar(dollarFuel) || 0}</TableCell>
                                <TableCell>{formatFloat(trip.fuel_burned_drive) || 0}</TableCell>
                                <TableCell>{formatFloat(trip.fuel_burned_idling) || 0}</TableCell>
                                <TableCell>{formatFloat(trip.mpg) || 0}</TableCell>
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