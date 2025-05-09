const Redis = require('ioredis');
require('dotenv').config();
const logger = require('../utils/logger');

let redisClient;

async function initializeRedis() {
    if (redisClient && redisClient.status === 'ready') {
        return redisClient;
    }

    const redisConfig = {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB, 10) || 0,
        retryStrategy(times) {
            const delay = Math.min(times * 50, 2000); // Exponential backoff, max 2s
            logger.warn(`Redis connection attempt ${times}, retrying in ${delay}ms`);
            return delay;
        },
        maxRetriesPerRequest: 20,
        enableOfflineQueue: true,
    };

    redisClient = new Redis(redisConfig);

    redisClient.on('connect', () => {
        logger.info('Redis connected successfully', { service: 'redis' });
    });

    redisClient.on('error', (error) => {
        logger.error('Redis connection error', { error: error.message, service: 'redis' });
    });

    redisClient.on('close', () => {
        logger.warn('Redis connection closed', { service: 'redis' });
    });

    redisClient.on('reconnecting', () => {
        logger.info('Redis reconnecting', { service: 'redis' });
    });

    try {
        const pingResponse = await redisClient.ping();
        if (pingResponse !== 'PONG') {
            throw new Error('Redis ping failed: Invalid response');
        }
        logger.info('Redis ping successful', { service: 'redis' });
    } catch (error) {
        logger.error('Failed to initialize Redis', { error: error.message, service: 'redis' });
        throw error;
    }

    return redisClient;
}

function getRedisClient() {
    if (!redisClient) {
        throw new Error('Redis client not initialized');
    }
    return redisClient;
}

module.exports = { initializeRedis, getRedisClient };