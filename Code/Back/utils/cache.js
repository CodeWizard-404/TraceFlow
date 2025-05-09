const { getRedisClient } = require('../config/redis');
const logger = require('./logger');

class Cache {
    constructor(prefix = 'cache:') {
        this.prefix = prefix;
        this.client = getRedisClient();
    }

    async getOrSet(key, fetchFn, ttl = 3600) {
        const cacheKey = `${this.prefix}${key}`;
        try {
            const cached = await this.client.get(cacheKey);
            if (cached) {
                logger.info(`Cache hit for key: ${cacheKey}`, { service: 'cache' });
                return JSON.parse(cached);
            }

            logger.info(`Cache miss for key: ${cacheKey}`, { service: 'cache' });
            const data = await fetchFn();
            await this.client.setex(cacheKey, ttl, JSON.stringify(data));
            return data;
        } catch (error) {
            logger.error(`Cache error for key: ${cacheKey}`, { error: error.message, service: 'cache' });
            return await fetchFn();
        }
    }

    async invalidate(key) {
        const cacheKey = `${this.prefix}${key}`;
        try {
            await this.client.del(cacheKey);
            logger.info(`Cache invalidated for key: ${cacheKey}`, { service: 'cache' });
        } catch (error) {
            logger.error(`Cache invalidation error for key: ${cacheKey}`, { error: error.message, service: 'cache' });
        }
    }

    async invalidateByPattern(pattern) {
        try {
            const keys = await this.client.keys(`${this.prefix}${pattern}`);
            if (keys.length > 0) {
                await this.client.del(keys);
                logger.info(`Invalidated ${keys.length} keys matching pattern: ${pattern}`, { service: 'cache' });
            }
        } catch (error) {
            logger.error(`Error invalidating keys by pattern: ${pattern}`, { error: error.message, service: 'cache' });
        }
    }
}

// Export a factory function instead of an instance
module.exports = async () => {
    // Ensure Redis is initialized before creating Cache
    const { initializeRedis } = require('../config/redis');
    await initializeRedis();
    return new Cache();
};