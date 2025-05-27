// mapUtils.js
const { Client } = require('@googlemaps/google-maps-services-js');
const logger = require('../utils/logger');

const client = new Client({});

async function getDistanceMatrix(origins, destinations, mode = 'driving') {
    try {
        const response = await client.distancematrix({
            params: {
                origins,
                destinations,
                mode,
                key: process.env.GOOGLE_MAPS_API_KEY,
                departure_time: 'now',
            },
        });
        const rows = response.data.rows;
        if (!rows.length) throw new Error('No distance matrix results found');
        return rows.map(row =>
            row.elements.map(element => ({
                distance: element.distance?.value / 1000 || null,
                duration: element.duration?.value / 60 || null,
                status: element.status,
            }))
        );
    } catch (error) {
        logger.error(`Failed to get distance matrix: ${error.message}`);
        throw new Error(`Failed to get distance matrix: ${error.message}`);
    }
}

module.exports = { getDistanceMatrix };