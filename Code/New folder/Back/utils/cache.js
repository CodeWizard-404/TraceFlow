const { getRedisClient, getRedisSubClient } = require('../config/redis');

class Cache {
    constructor(prefix = 'cache:') {
        this.prefix = prefix;
        this.client = getRedisClient();
        this.subClient = getRedisSubClient();
        this.ttlMap = {
            api: 300,    // 5 minutes for API responses
            user: 3600,  // 1 hour for user data
            session: 86400, // 24 hours for sessions
            checklist: 300, // 5 minutes for checklists
        };
        this.versionKeys = {
            users: 'version:users',
            checklists: 'version:checklists',
        };

        // Subscribe to version update events
        this.subClient.subscribe('cache:version_update', (err) => {
            if (err) console.error('Subscription error:', err);
        });

        this.subClient.on('message', async (channel, message) => {
            if (channel === 'cache:version_update') {
                const { tag, version } = JSON.parse(message);
                await this.client.set(`version:${tag}`, version);
            }
        });
    }

    async set(key, data, ttlOrType = 'user') {
        const cacheKey = `${this.prefix}${key}`;
        const ttl = typeof ttlOrType === 'number' ? ttlOrType : this.ttlMap[ttlOrType] || 3600;
        const tag = key.split(':')[0];
        const versionKey = this.versionKeys[tag] || `version:${tag}`;
        const versionCacheKey = `${cacheKey}:version`;

        try {
            const currentVersion = await this.client.get(versionKey);
            const newVersion = currentVersion ? parseInt(currentVersion) + 1 : 1;

            await Promise.all([
                this.client.setex(cacheKey, ttl, JSON.stringify(data)),
                this.client.set(versionCacheKey, newVersion),
                this.client.set(versionKey, newVersion),
                this.client.sadd(`tag:${tag}`, cacheKey),
                this.client.publish('cache:version_update', JSON.stringify({ tag, version: newVersion })),
            ]);

            return data;
        } catch (error) {
            console.error('Cache set error:', error);
            throw error;
        }
    }



    async getOrSet(key, fetchFn, ttlOrType = 'user') {
        const cacheKey = `${this.prefix}${key}`;
        const ttl = typeof ttlOrType === 'number' ? ttlOrType : this.ttlMap[ttlOrType] || 3600;
        const tag = key.split(':')[0]; // e.g., 'user' from 'user:123'
        const versionKey = this.versionKeys[tag] || `version:${tag}`;
        const versionCacheKey = `${cacheKey}:version`;

        try {
            // Get current data version and cached version
            const [currentVersion, cachedVersion, cachedData] = await Promise.all([
                this.client.get(versionKey),
                this.client.get(versionCacheKey),
                this.client.get(cacheKey),
            ]);

            // If data exists and versions match, return cached data
            if (cachedData && currentVersion === cachedVersion) {
                return JSON.parse(cachedData);
            }

            // Fetch fresh data
            const data = await fetchFn();
            const newVersion = currentVersion ? parseInt(currentVersion) + 1 : 1;

            // Store new data and version
            await Promise.all([
                this.client.setex(cacheKey, ttl, JSON.stringify(data)),
                this.client.set(versionCacheKey, newVersion),
                this.client.set(versionKey, newVersion),
                this.client.sadd(`tag:${tag}`, cacheKey),
                this.client.publish('cache:version_update', JSON.stringify({ tag, version: newVersion })),
            ]);

            return data;
        } catch (error) {
            console.error('Cache getOrSet error:', error);
            return await fetchFn(); // Fallback to fresh data
        }
    }

    async hgetOrSet(key, fetchFn, ttlOrType = 'user') {
        const cacheKey = `${this.prefix}${key}`;
        const ttl = typeof ttlOrType === 'number' ? ttlOrType : this.ttlMap[ttlOrType] || 3600;
        const tag = key.split(':')[0];
        const versionKey = this.versionKeys[tag] || `version:${tag}`;
        const versionCacheKey = `${cacheKey}:version`;

        try {
            const [currentVersion, cachedVersion, cachedData] = await Promise.all([
                this.client.get(versionKey),
                this.client.get(versionCacheKey),
                this.client.hgetall(cacheKey),
            ]);

            if (cachedData && Object.keys(cachedData).length && currentVersion === cachedVersion) {
                return cachedData;
            }

            const data = await fetchFn();
            const newVersion = currentVersion ? parseInt(currentVersion) + 1 : 1;

            await Promise.all([
                this.client.hmset(cacheKey, data),
                this.client.expire(cacheKey, ttl),
                this.client.set(versionCacheKey, newVersion),
                this.client.set(versionKey, newVersion),
                this.client.sadd(`tag:${tag}`, cacheKey),
                this.client.publish('cache:version_update', JSON.stringify({ tag, version: newVersion })),
            ]);

            return data;
        } catch (error) {
            console.error('Cache hgetOrSet error:', error);
            return await fetchFn();
        }
    }

    async invalidate(key) {
        const cacheKey = `${this.prefix}${key}`;
        const tag = key.split(':')[0];
        const versionKey = this.versionKeys[tag] || `version:${tag}`;
        const versionCacheKey = `${cacheKey}:version`;

        try {
            const currentVersion = await this.client.get(versionKey);
            const newVersion = currentVersion ? parseInt(currentVersion) + 1 : 1;

            await Promise.all([
                this.client.del(cacheKey),
                this.client.del(versionCacheKey),
                this.client.set(versionKey, newVersion),
                this.client.publish('cache:version_update', JSON.stringify({ tag, version: newVersion })),
            ]);
        } catch (error) {
            console.error('Cache invalidate error:', error);
        }
    }

    async invalidateByTag(tag) {
        const keys = await this.client.smembers(`tag:${tag}`);
        const versionKey = this.versionKeys[tag] || `version:${tag}`;
        const currentVersion = await this.client.get(versionKey);
        const newVersion = currentVersion ? parseInt(currentVersion) + 1 : 1;

        try {
            if (keys.length) {
                await Promise.all([
                    this.client.del(keys),
                    ...keys.map(key => this.client.del(`${key}:version`)),
                    this.client.del(`tag:${tag}`),
                    this.client.set(versionKey, newVersion),
                    this.client.publish('cache:version_update', JSON.stringify({ tag, version: newVersion })),
                ]);
            }
        } catch (error) {
            console.error('Cache invalidateByTag error:', error);
        }
    }
}

module.exports = async () => {
    await require('../config/redis').initializeRedis();
    return new Cache();
};