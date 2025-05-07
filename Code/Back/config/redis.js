const Redis = require('ioredis');
const logger = require('../utils/logger');
require('dotenv').config();

let redisClient;

async function initializeRedis() {
    if (redisClient) {
        return redisClient;
    }

    const redisConfig = {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        retryStrategy(times) {
            const delay = Math.min(times * 50, 2000); // Exponential backoff, max 2s
            logger.warn(`Retrying Redis connection attempt ${times}, delay: ${delay}ms`);
            return delay;
        },
    };

    redisClient = new Redis(redisConfig);

    redisClient.on('connect', () => {
        logger.info('Connected to Redis successfully');
    });

    redisClient.on('error', (error) => {
        logger.error(`Redis connection error: ${error.message}`);
    });

    redisClient.on('close', () => {
        logger.warn('Redis connection closed');
    });

    // Verify Redis client version
    try {
        const info = await redisClient.info();
        logger.info(`Redis server info: ${info.split('\r\n')[0]}`);
    } catch (error) {
        logger.error(`Failed to fetch Redis server info: ${error.message}`);
    }

    // Ensure the client is ready
    try {
        const pingResponse = await redisClient.ping();
        if (pingResponse !== 'PONG') {
            throw new Error('Redis ping failed: Invalid response');
        }
        logger.info('Redis ping successful');
    } catch (error) {
        logger.error(`Redis ping failed: ${error.message}`);
        throw new Error('Failed to initialize Redis');
    }

    return redisClient;
}

module.exports = { initializeRedis };