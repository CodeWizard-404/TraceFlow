const { getRedisClient } = require('../config/redis');

class Cache {
    constructor(prefix = 'cache:') {
        this.prefix = prefix;
        this.client = getRedisClient();
        this.ttlMap = {
            api: 300,    // 5 minutes for API responses
            user: 3600,  // 1 hour for user data
            session: 86400, // 24 hours for sessions
        };
    }

    async getOrSet(key, fetchFn, ttlOrType = 'user') {
        const cacheKey = `${this.prefix}${key}`;
        const ttl = typeof ttlOrType === 'number' ? ttlOrType : this.ttlMap[ttlOrType] || 3600;
        const tag = key.split(':')[0]; // e.g., 'user' from 'user:123'

        try {
            const cached = await this.client.get(cacheKey);
            if (cached) return JSON.parse(cached);

            const data = await fetchFn();
            await this.client.setex(cacheKey, ttl, JSON.stringify(data));
            await this.client.sadd(`tag:${tag}`, cacheKey); // Track keys by tag
            return data;
        } catch (error) {
            return await fetchFn(); // Fallback
        }
    }

    async hgetOrSet(key, fetchFn, ttlOrType = 'user') {
        const cacheKey = `${this.prefix}${key}`;
        const ttl = typeof ttlOrType === 'number' ? ttlOrType : this.ttlMap[ttlOrType] || 3600;
        const tag = key.split(':')[0];

        try {
            const cached = await this.client.hgetall(cacheKey);
            if (cached && Object.keys(cached).length) return cached;

            const data = await fetchFn();
            await this.client.hmset(cacheKey, data);
            await this.client.expire(cacheKey, ttl);
            await this.client.sadd(`tag:${tag}`, cacheKey);
            return data;
        } catch (error) {
            return await fetchFn();
        }
    }

    async invalidate(key) {
        const cacheKey = `${this.prefix}${key}`;
        await this.client.del(cacheKey);
    }

    async invalidateByTag(tag) {
        const keys = await this.client.smembers(`tag:${tag}`);
        if (keys.length) await this.client.del(keys);
        await this.client.del(`tag:${tag}`);
    }
}

module.exports = async () => {
    await require('../config/redis').initializeRedis();
    return new Cache();
};