const { getRedisClient } = require('../config/redis');
const logger = require('./logger');

class RedisUtils {
    constructor() {
        this.redis = getRedisClient();
        this.cache = global.cache;
    }

    async storeUser(userId, userData) {
        const key = `user:${userId}`;
        await this.redis.hset(key, { ...userData, roles: JSON.stringify(userData.roles || []) });
        await this.redis.expire(key, 86400);
    }

    async getUser(userId) {
        const key = `user:${userId}`;
        const data = await this.redis.hgetall(key);
        return data && Object.keys(data).length ? { ...data, roles: JSON.parse(data.roles || '[]') } : null;
    }

    async invalidateUser(userId) {
        await this.cache.invalidate(`user:${userId}`);
        await this.redis.publish('cache:invalidate', `user:${userId}`);
    }

    async storeUserWithDetails(userId, userData) {
        const key = `user:details:${userId}`;
        await this.redis.setex(key, 3600, JSON.stringify(userData));
    }

    async getUserWithDetails(userId) {
        const key = `user:details:${userId}`;
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
    }

    async storeUserPreferences(userId, preferences) {
        const key = `preferences:${userId}`;
        await this.redis.setex(key, 3600, JSON.stringify(preferences));
    }

    async getUserPreferences(userId) {
        const key = `preferences:${userId}`;
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
    }

    async invalidateUserPreferences(userId) {
        const key = `preferences:${userId}`;
        await this.redis.del(key);
    }

    async publishEvent(channel, data, retries = 3) {
        try {
            await this.redis.publish(channel, JSON.stringify(data));
        } catch (error) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.publishEvent(channel, data, retries - 1);
            }
            throw error;
        }
    }

    async updateAndInvalidateUser(userId, userData) {
        const lua = `
            redis.call('HSET', KEYS[1], unpack(ARGV))
            redis.call('EXPIRE', KEYS[1], 86400)
            redis.call('PUBLISH', 'cache:invalidate', KEYS[1])
        `;
        await this.redis.eval(lua, 1, `user:${userId}`, ...Object.entries(userData).flat());
    }
}

module.exports = new RedisUtils();