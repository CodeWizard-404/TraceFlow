const Redis = require('ioredis');
require('dotenv').config();
const logger = require('../utils/logger');

let redisClient;
let redisSubClient;

async function initializeRedis() {
    if (redisClient?.status === 'ready' && redisSubClient?.status === 'ready') {
        return { redisClient, redisSubClient };
    }

    const isCluster = process.env.REDIS_CLUSTER === 'true';
    const redisConfig = {
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB, 10) || 0,
        retryStrategy: (times) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 20,
        enableOfflineQueue: true,
        ...(!isCluster && {
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        }),
        ...(isCluster && {
            cluster: {
                nodes: JSON.parse(process.env.REDIS_CLUSTER_NODES || '[{"host": "127.0.0.1", "port": 6379}]'),
                scaleReads: 'slave',
            },
        }),
        ...(process.env.NODE_ENV === 'production' && {
            tls: { rejectUnauthorized: false },
        }),
    };

    redisClient = isCluster ? new Redis.Cluster(redisConfig.cluster.nodes, redisConfig) : new Redis(redisConfig);
    redisSubClient = isCluster ? new Redis.Cluster(redisConfig.cluster.nodes, redisConfig) : new Redis(redisConfig);

    // Event handlers
    const clients = { redisClient, redisSubClient };
    for (const [name, client] of Object.entries(clients)) {
        client.on('connect', () => logger.info(`${name} connected`, { service: 'redis' }));
        client.on('error', (err) => logger.error(`${name} error`, { error: err.message, service: 'redis' }));
        client.on('close', () => logger.warn(`${name} closed`, { service: 'redis' }));
        client.on('reconnecting', () => logger.info(`${name} reconnecting`, { service: 'redis' }));
    }

    // Verify connectivity
    const [mainPing, subPing] = await Promise.all([redisClient.ping(), redisSubClient.ping()]);
    if (mainPing !== 'PONG' || subPing !== 'PONG') {
        throw new Error('Redis ping failed');
    }

    // Initialize version keys
    const versionKeys = ['version:users', 'version:checklists'];
    for (const key of versionKeys) {
        const exists = await redisClient.exists(key);
        if (!exists) {
            await redisClient.set(key, '1');
        }
    }

    // Monitor Redis (every 5 minutes)
    setInterval(async () => {
        try {
            await redisClient.info();
        } catch (error) {
            logger.error('Redis monitoring error', { error: error.message, service: 'redis' });
        }
    }, 300000);

    return { redisClient, redisSubClient };
}

module.exports = {
    initializeRedis,
    getRedisClient: () => redisClient,
    getRedisSubClient: () => redisSubClient,
};