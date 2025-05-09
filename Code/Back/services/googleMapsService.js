const { Client } = require('@googlemaps/google-maps-services-js');
const { initializeRedis } = require('../config/redis');
const logger = require('../utils/logger');
require('dotenv').config();

class GoogleMapsService {
    static async initialize() {
        if (!process.env.GOOGLE_MAPS_API_KEY) {
            this.client = null;
            return;
        }

        try {
            this.client = new Client({});
            this.redisClient = await initializeRedis();
        } catch (error) {
            this.redisClient = null;
            this.client = new Client({});
        }
    }

    static async geocodeAddress(address) {
        if (!this.client) {
            return { mock: true, address };
        }

        try {
            const cacheKey = `geocode:${address}`;
            let cachedResult;
            if (this.redisClient) {
                cachedResult = await this.redisClient.get(cacheKey);
                if (cachedResult) {
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
            return result;
        } catch (error) {
            throw new Error(`Failed to geocode address: ${error.message}`);
        }
    }

    static async getDirections(origin, destination, mode = 'driving') {
        if (!this.client) {
            return { mock: true, origin, destination };
        }

        try {
            const cacheKey = `directions:${origin}:${destination}:${mode}`;
            let cachedResult;
            if (this.redisClient) {
                cachedResult = await this.redisClient.get(cacheKey);
                if (cachedResult) {
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
            return result;
        } catch (error) {
            throw new Error(`Failed to get directions: ${error.message}`);
        }
    }

    static async searchPlaces(query, location, radius = 5000) {
        if (!this.client) {
            return { mock: true, query };
        }

        try {
            const cacheKey = `places:${query}:${location?.lat || ''}:${location?.lng || ''}:${radius}`;
            let cachedResult;
            if (this.redisClient) {
                cachedResult = await this.redisClient.get(cacheKey);
                if (cachedResult) {
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
            return result;
        } catch (error) {
            throw new Error(`Failed to search places: ${error.message}`);
        }
    }

    static async getDistanceMatrix(origins, destinations, mode = 'driving') {
        if (!this.client) {
            return { mock: true, origins, destinations };
        }

        try {
            const cacheKey = `distanceMatrix:${origins.join('|')}:${destinations.join('|')}:${mode}`;
            let cachedResult;
            if (this.redisClient) {
                cachedResult = await this.redisClient.get(cacheKey);
                if (cachedResult) {
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
            return result;
        } catch (error) {
            throw new Error(`Failed to get distance matrix: ${error.message}`);
        }
    }
}

GoogleMapsService.initialize().catch((error) => {
    logger.error(`Google Maps Service initialization failed: ${error.message}`);
});

module.exports = GoogleMapsService;