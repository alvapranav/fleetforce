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
    Tab,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const TripsList = () => {
    const [trips, setTrips] = useState([])
    const [filteredTrips, setFilteredTrips] = useState([])
    const [filters, setFilters] = useState({
        tripId: '',
        tractorId: '',
        startDate: '',
        endDate: '',
    })
    const [page, setPage] = useState(0)
    const [rowsPerPage] = useState(10)
    const history = useNavigate()

    useEffect(() => {
        const fetchTrips = async () => {
            try {
                const response = await axios.get('api/trips')
                setTrips(response.data)
                setFilteredTrips(response.data)
            }
            catch (error) {
                console.error('Error fetching trips', error)
            }
        }
        fetchTrips()
    }, [])

    const handleFilterChange = (e) => {
        setFilters({
            ...filters,
            [e.target.name]: e.target.value,
        })
    }

    const applyFilters = () => {
        let filtered = trips

        if (filters.tripId) {
            filtered = filtered.filter((trip) => trip.trip_ref_norm.includes(filters.tripId))
        }
        if (filters.tractorId) {
            filtered = filtered.filter((trip) => trip.tractor_id.includes(filters.tractorId))
        }
        if (filters.startDate) {
            filtered = filtered.filter((trip) => new Date(trip.arrival_datetime) >= new Date(filters.startDate))
        }
        if (filters.endDate) {
            filtered = filtered.filter((trip) => new Date(trip.to_arrival_datetime) <= new Date(filters.endDate))
        }

        setFilteredTrips(filtered)
        setPage(0)
    }

    const handleRowClick = (trip) => {
        history(`/explore/${trip.trip_ref_norm}/${trip.arrival_datetime}`)
    }

    return (
        <div>
            <h1>Trip List</h1>
            <div className='filters'>
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
                    value={filters.startDate}
                    onChange={handleFilterChange}
                    variant='outlined'
                    size='small'
                    style={{ marginRight: '10px' }}
                />
                <TextField
                    name='endDate'
                    label='End Date'
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
                        <TableCell>Trip ID</TableCell>
                        <TableCell>Tractor ID</TableCell>
                        <TableCell>Origin City</TableCell>
                        <TableCell>Origin State</TableCell>
                        <TableCell>Destination City</TableCell>
                        <TableCell>Destination State</TableCell>
                        <TableCell>Departure Date</TableCell>
                        <TableCell>Arrival Date</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {filteredTrips.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((trip) => (
                        <TableRow key={trip.trip_ref_norm} onClick={() => handleRowClick(trip)} style={{cursor: 'pointer'}}>
                            <TableCell>{trip.trip_ref_norm}</TableCell>
                            <TableCell>{trip.tractor_id}</TableCell>
                            <TableCell>{trip.city}</TableCell>
                            <TableCell>{trip.state}</TableCell>
                            <TableCell>{trip.to_city}</TableCell>
                            <TableCell>{trip.to_state}</TableCell>
                            <TableCell>{trip.arrival_datetime}</TableCell>
                            <TableCell>{trip.to_arrival_datetime}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <TablePagination
            component='div'
            count={filteredTrips.length}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[]}
            />
        </div>
    )
}

export default TripsList