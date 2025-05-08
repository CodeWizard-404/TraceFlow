const { Client } = require('@googlemaps/google-maps-services-js');
const { initializeRedis } = require('../config/redis');
const logger = require('../utils/logger');
require('dotenv').config();

class GoogleMapsService {
    static async initialize() {
        if (!process.env.GOOGLE_MAPS_API_KEY) {
            logger.warn('Google Maps API key is missing. Maps features are disabled.');
            this.client = null;
            return;
        }

        try {
            this.client = new Client({});
            this.redisClient = await initializeRedis();
            logger.info('GoogleMapsService initialized with Redis');
        } catch (error) {
            logger.error(`Failed to initialize Redis: ${error.message}`);
            this.redisClient = null;
            this.client = new Client({});
            logger.warn('GoogleMapsService initialized without Redis caching');
        }
    }

    static async geocodeAddress(address) {
        if (!this.client) {
            logger.warn('Google Maps client not initialized. Returning mock geocoding data.');
            return { mock: true, address };
        }

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

    static async getDirections(origin, destination, mode = 'driving') {
        if (!this.client) {
            logger.warn('Google Maps client not initialized. Returning mock directions data.');
            return { mock: true, origin, destination };
        }

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

    static async searchPlaces(query, location, radius = 5000) {
        if (!this.client) {
            logger.warn('Google Maps client not initialized. Returning mock places data.');
            return { mock: true, query };
        }

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

    static async getDistanceMatrix(origins, destinations, mode = 'driving') {
        if (!this.client) {
            logger.warn('Google Maps client not initialized. Returning mock distance matrix data.');
            return { mock: true, origins, destinations };
        }

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

GoogleMapsService.initialize().catch((error) => {
    logger.error(`Google Maps Service initialization failed: ${error.message}`);
});

module.exports = GoogleMapsService;