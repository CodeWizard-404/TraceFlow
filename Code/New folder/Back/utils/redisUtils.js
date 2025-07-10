const { getRedisClient } = require('../config/redis');
const cache = require('./cache');

class RedisUtils {
    constructor() {
        this.redis = getRedisClient();
        this.cache = null;
    }

    async initCache() {
        if (!this.cache) {
            this.cache = await cache();
        }
    }

    async storeUser(userId, userData) {
        await this.initCache();
        const key = `user:${userId}`;
        await this.redis.hset(key, { ...userData, roles: JSON.stringify(userData.roles || []) });
        await this.redis.expire(key, 86400);
    }

    async getUser(userId) {
        await this.initCache();
        const key = `user:${userId}`;
        const data = await this.redis.hgetall(key);
        return data && Object.keys(data).length ? { ...data, roles: JSON.parse(data.roles || '[]') } : null;
    }

    async invalidateUser(userId) {
        await this.initCache();
        await this.cache.invalidate(`user:${userId}`);
        await this.redis.publish('cache:invalidate', `user:${userId}`);
    }

    async storeUserWithDetails(userId, userData) {
        await this.initCache();
        const key = `user:details:${userId}`;
        await this.redis.setex(key, 3600, JSON.stringify(userData));
    }

    async getUserWithDetails(userId) {
        await this.initCache();
        const key = `user:details:${userId}`;
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
    }

    async storeUserPreferences(userId, preferences) {
        await this.initCache();
        const key = `preferences:${userId}`;
        await this.redis.setex(key, 3600, JSON.stringify(preferences));
    }

    async getUserPreferences(userId) {
        await this.initCache();
        const key = `preferences:${userId}`;
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
    }

    async invalidateUserPreferences(userId) {
        await this.initCache();
        const key = `preferences:${userId}`;
        await this.redis.del(key);
    }

    async invalidateRoles() {
        await this.initCache();
        await this.cache.invalidateByTag('roles');
        await this.cache.invalidate('roles:all');
        await this.redis.set('roles:last_updated', Date.now().toString());
        await this.redis.publish('cache:invalidate', 'roles:all');
    }

    async publishEvent(channel, data, retries = 3) {
        await this.initCache();
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
        await this.initCache();
        const lua = `
            redis.call('HSET', KEYS[1], unpack(ARGV))
            redis.call('EXPIRE', KEYS[1], 86400)
            redis.call('PUBLISH', 'cache:invalidate', KEYS[1])
        `;
        await this.redis.eval(lua, 1, `user:${userId}`, ...Object.entries(userData).flat());
    }
}

module.exports = new RedisUtils();