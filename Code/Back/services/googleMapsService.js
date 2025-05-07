const { Client } = require('@googlemaps/google-maps-services-js');
const { initializeRedis } = require('../config/redis');
const logger = require('../utils/logger');
require('dotenv').config();

class GoogleMapsService {
    static async initialize() {
        try {
            this.client = new Client({});
            this.redisClient = await initializeRedis();
            logger.info('GoogleMapsService initialized with Redis');
        } catch (error) {
            logger.error(`Failed to initialize Redis: ${error.message}`);
            this.redisClient = null; // Fallback to no caching
            this.client = new Client({});
            logger.warn('GoogleMapsService initialized without Redis caching');
        }
    }

    /**
     * Geocode an address using Google Maps Geocoding API.
     * @param {string} address - The address to geocode.
     * @returns {Promise<Object>} Geocoded location data.
     */
    static async geocodeAddress(address) {
        try {
            const cacheKey = `geocode:${address}`;
            let cachedResult;
            if (this.redisClient) {
                cachedResult = await this.redisClient.get(cacheKey);
                if (cachedResult) {
                    logger.info(`Geocode cache hit for address: ${address}`);
                    return JSON.parse(cachedResult);
                }
            }

            const response = await this.client.geocode({
                params: {
                    address,
                    key: process.env.GOOGLE_MAPS_API_KEY,
                },
            });

            const result = response.data.results[0];
            if (!result) {
                const error = new Error('No geocoding results found');
                error.status = 404;
                throw error;
            }

            if (this.redisClient) {
                await this.redisClient.set(cacheKey, JSON.stringify(result), 'EX', 3600);
            }
            logger.info(`Geocoded address: ${address}`);
            return result;
        } catch (error) {
            logger.error(`Geocode error: ${error.message}`);
            throw new Error(`Failed to geocode address: ${error.message}`);
        }
    }

    /**
     * Get directions between two points using Google Maps Directions API.
     * @param {string} origin - Starting point.
     * @param {string} destination - Ending point.
     * @param {string} [mode='driving'] - Travel mode.
     * @returns {Promise<Object>} Directions data.
     */
    static async getDirections(origin, destination, mode = 'driving') {
        try {
            const cacheKey = `directions:${origin}:${destination}:${mode}`;
            let cachedResult;
            if (this.redisClient) {
                cachedResult = await this.redisClient.get(cacheKey);
                if (cachedResult) {
                    logger.info(`Directions cache hit for ${origin} to ${destination}`);
                    return JSON.parse(cachedResult);
                }
            }

            const response = await this.client.directions({
                params: {
                    origin,
                    destination,
                    mode,
                    key: process.env.GOOGLE_MAPS_API_KEY,
                },
            });

            const result = response.data.routes[0];
            if (!result) {
                const error = new Error('No directions found');
                error.status = 404;
                throw error;
            }

            if (this.redisClient) {
                await this.redisClient.set(cacheKey, JSON.stringify(result), 'EX', 3600);
            }
            logger.info(`Fetched directions from ${origin} to ${destination}`);
            return result;
        } catch (error) {
            logger.error(`Directions error: ${error.message}`);
            throw new Error(`Failed to get directions: ${error.message}`);
        }
    }

    /**
     * Search for places using Google Maps Places API.
     * @param {string} query - Search query.
     * @param {Object} [location] - Optional location coordinates.
     * @param {number} [radius=5000] - Search radius in meters.
     * @returns {Promise<Object>} Place search results.
     */
    static async searchPlaces(query, location, radius = 5000) {
        try {
            const cacheKey = `places:${query}:${location?.lat || ''}:${location?.lng || ''}:${radius}`;
            let cachedResult;
            if (this.redisClient) {
                cachedResult = await this.redisClient.get(cacheKey);
                if (cachedResult) {
                    logger.info(`Places cache hit for query: ${query}`);
                    return JSON.parse(cachedResult);
                }
            }

            const response = await this.client.places({
                params: {
                    query,
                    location: location ? `${location.lat},${location.lng}` : undefined,
                    radius,
                    key: process.env.GOOGLE_MAPS_API_KEY,
                },
            });

            const result = response.data.results;
            if (!result.length) {
                const error = new Error('No places found');
                error.status = 404;
                throw error;
            }

            if (this.redisClient) {
                await this.redisClient.set(cacheKey, JSON.stringify(result), 'EX', 3600);
            }
            logger.info(`Searched places for query: ${query}`);
            return result;
        } catch (error) {
            logger.error(`Places search error: ${error.message}`);
            throw new Error(`Failed to search places: ${error.message}`);
        }
    }

    /**
     * Get distance matrix using Google Maps Distance Matrix API.
     * @param {string[]} origins - Array of origin points.
     * @param {string[]} destinations - Array of destination points.
     * @param {string} [mode='driving'] - Travel mode.
     * @returns {Promise<Object>} Distance matrix data.
     */
    static async getDistanceMatrix(origins, destinations, mode = 'driving') {
        try {
            const cacheKey = `distanceMatrix:${origins.join('|')}:${destinations.join('|')}:${mode}`;
            let cachedResult;
            if (this.redisClient) {
                cachedResult = await this.redisClient.get(cacheKey);
                if (cachedResult) {
                    logger.info(`Distance matrix cache hit for origins: ${origins.join(', ')}`);
                    return JSON.parse(cachedResult);
                }
            }

            const response = await this.client.distancematrix({
                params: {
                    origins,
                    destinations,
                    mode,
                    key: process.env.GOOGLE_MAPS_API_KEY,
                },
            });

            const result = response.data.rows;
            if (!result.length) {
                const error = new Error('No distance matrix results found');
                error.status = 404;
                throw error;
            }

            if (this.redisClient) {
                await this.redisClient.set(cacheKey, JSON.stringify(result), 'EX', 3600);
            }
            logger.info(`Fetched distance matrix for origins: ${origins.join(', ')}`);
            return result;
        } catch (error) {
            logger.error(`Distance matrix error: ${error.message}`);
            throw new Error(`Failed to get distance matrix: ${error.message}`);
        }
    }
}

// Initialize the service
GoogleMapsService.initialize().catch((error) => {
    logger.error(`Google Maps Service initialization failed: ${error.message}`);
});

module.exports = GoogleMapsService;