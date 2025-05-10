const { getRedisClient } = require('../config/redis');

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
                console.info(`Cache hit for key `, { service: 'cache' });
                return JSON.parse(cached);
            }

            console.info(`Cache miss for key `, { service: 'cache' });
            const data = await fetchFn();
            await this.client.setex(cacheKey, ttl, JSON.stringify(data));
            return data;
        } catch (error) {
            console.error(`Cache error for key `, { error: error.message, service: 'cache' });
            return await fetchFn();
        }
    }

    async invalidate(key) {
        const cacheKey = `${this.prefix}${key}`;
        try {
            await this.client.del(cacheKey);
            console.info(`Cache invalidated for key`, { service: 'cache' });
        } catch (error) {
            console.error(`Cache invalidation error for key`, { error: error.message, service: 'cache' });
        }
    }

    async invalidateByPattern(pattern) {
        try {
            const keys = await this.client.keys(`${this.prefix}${pattern}`);
            if (keys.length > 0) {
                await this.client.del(keys);
                console.info(`Invalidated ${keys.length} keys matching pattern: ${pattern}`, { service: 'cache' });
            }
        } catch (error) {
            console.error(`Error invalidating keys by pattern: ${pattern}`, { error: error.message, service: 'cache' });
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