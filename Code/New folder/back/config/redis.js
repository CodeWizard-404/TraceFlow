const Redis = require('ioredis');
require('dotenv').config();
const logger = require('../utils/logger');

let redisClient; // For general operations (including publishing)
let redisSubClient; // For Pub/Sub subscriptions

async function initializeRedis() {
    if (redisClient && redisClient.status === 'ready' && redisSubClient && redisSubClient.status === 'ready') {
        return { redisClient, redisSubClient };
    }

    const isCluster = process.env.REDIS_CLUSTER === 'true';
    const redisConfig = {
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB, 10) || 0,
        retryStrategy(times) {
            const delay = Math.min(times * 50, 2000);
            logger.warn(`Redis connection attempt ${times}, retrying in ${delay}ms`, { service: 'redis' });
            return delay;
        },
        maxRetriesPerRequest: 20,
        enableOfflineQueue: true,
    };

    if (isCluster) {
        // Cluster mode for production
        const nodes = process.env.REDIS_CLUSTER_NODES
            ? JSON.parse(process.env.REDIS_CLUSTER_NODES)
            : [{ host: '127.0.0.1', port: 6379 }];
        redisConfig.cluster = {
            nodes,
            clusterRetryStrategy: (times) => {
                const delay = Math.min(times * 100, 3000);
                logger.warn(`Redis cluster retry attempt ${times}, retrying in ${delay}ms`, { service: 'redis' });
                return delay;
            },
            scaleReads: 'slave',
        };
    } else {
        // Standalone mode for development
        redisConfig.host = process.env.REDIS_HOST || '127.0.0.1';
        redisConfig.port = parseInt(process.env.REDIS_PORT, 10) || 6379;
    }

    // Initialize main client for general operations
    redisClient = isCluster ? new Redis.Cluster(redisConfig.cluster.nodes, redisConfig) : new Redis(redisConfig);

    // Initialize separate client for Pub/Sub
    redisSubClient = isCluster ? new Redis.Cluster(redisConfig.cluster.nodes, redisConfig) : new Redis(redisConfig);

    // Event handlers for main client
    redisClient.on('connect', () => {
        logger.info(`Redis main client connected successfully (${isCluster ? 'cluster' : 'standalone'})`, { service: 'redis' });
    });
    redisClient.on('error', (error) => {
        logger.error('Redis main client connection error', { error: error.message, service: 'redis' });
    });
    redisClient.on('close', () => {
        logger.warn('Redis main client connection closed', { service: 'redis' });
    });
    redisClient.on('reconnecting', () => {
        logger.info('Redis main client reconnecting', { service: 'redis' });
    });

    // Event handlers for subscriber client
    redisSubClient.on('connect', () => {
        logger.info(`Redis subscriber client connected successfully (${isCluster ? 'cluster' : 'standalone'})`, { service: 'redis' });
    });
    redisSubClient.on('error', (error) => {
        logger.error('Redis subscriber client connection error', { error: error.message, service: 'redis' });
    });
    redisSubClient.on('close', () => {
        logger.warn('Redis subscriber client connection closed', { service: 'redis' });
    });
    redisSubClient.on('reconnecting', () => {
        logger.info('Redis subscriber client reconnecting', { service: 'redis' });
    });

    // Ping both clients to verify connectivity
    try {
        const [mainPing, subPing] = await Promise.all([
            redisClient.ping(),
            redisSubClient.ping(),
        ]);
        if (mainPing !== 'PONG' || subPing !== 'PONG') {
            throw new Error('Redis ping failed: Invalid response');
        }
        logger.info('Redis ping successful for both clients', { service: 'redis' });
    } catch (error) {
        logger.error('Failed to initialize Redis', { error: error.message, service: 'redis' });
        throw error;
    }

    return { redisClient, redisSubClient };
}

function getRedisClient() {
    if (!redisClient) {
        throw new Error('Redis main client not initialized');
    }
    return redisClient;
}

function getRedisSubClient() {
    if (!redisSubClient) {
        throw new Error('Redis subscriber client not initialized');
    }
    return redisSubClient;
}

module.exports = { initializeRedis, getRedisClient, getRedisSubClient };