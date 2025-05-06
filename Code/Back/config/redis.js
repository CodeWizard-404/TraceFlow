const Redis = require('redis');
const logger = require('../utils/logger');
require('dotenv').config();

// Initialize Redis client
async function initializeRedis() {
    try {
        const redisClient = Redis.createClient({
            url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
            password: process.env.REDIS_PASSWORD || undefined,
        });

        redisClient.on('error', (err) => {
            logger.error(`Redis connection error: ${err.message}`, {
                stack: err.stack,
                timestamp: new Date().toISOString(),
            });
        });

        redisClient.on('connect', () => {
            logger.info('Connected to Redis', {
                host: process.env.REDIS_HOST,
                port: process.env.REDIS_PORT,
                timestamp: new Date().toISOString(),
            });
        });

        await redisClient.connect();
        return redisClient;
    } catch (error) {
        logger.error(`Redis initialization failed: ${error.message}`, {
            stack: error.stack,
            timestamp: new Date().toISOString(),
        });
        throw error;
    }
}

module.exports = { initializeRedis };