const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

class RedisUtils {
    constructor() {
        this.redis = getRedisClient();
    }

    // Store user object as a Redis Hash
    async storeUser(userId, userData) {
        const key = `user:${userId}`;
        try {
            await this.redis.hset(key, {
                email: userData.email || '',
                firstname: userData.firstname || '',
                lastname: userData.lastname || '',
                phone: userData.phone || '',
                roles: JSON.stringify(userData.roles || []),
            });
            await this.redis.expire(key, 86400); // 1 day TTL
            logger.info(`Stored user data in Redis Hash: ${userId}`, { service: 'redis' });
        } catch (error) {
            logger.error(`Failed to store user data in Redis: ${userId}`, { error: error.message, service: 'redis' });
            throw error;
        }
    }

    // Retrieve user object from Redis Hash
    async getUser(userId) {
        const key = `user:${userId}`;
        try {
            const data = await this.redis.hgetall(key);
            if (!Object.keys(data).length) {
                return null;
            }
            return {
                email: data.email,
                firstname: data.firstname,
                lastname: data.lastname,
                phone: data.phone,
                roles: JSON.parse(data.roles || '[]'),
            };
        } catch (error) {
            logger.error(`Failed to retrieve user data from Redis: ${userId}`, { error: error.message, service: 'redis' });
            return null;
        }
    }

    // Store role object as a Redis Hash
    async storeRole(roleId, roleData) {
        const key = `role:${roleId}`;
        try {
            await this.redis.hset(key, {
                name: roleData.name || '',
                description: roleData.description || '',
                permissions: JSON.stringify(roleData.permissions || []),
            });
            await this.redis.expire(key, 86400); // 1 day TTL
            logger.info(`Stored role data in Redis Hash: ${roleId}`, { service: 'redis' });
        } catch (error) {
            logger.error(`Failed to store role data in Redis: ${roleId}`, { error: error.message, service: 'redis' });
            throw error;
        }
    }

    // Retrieve role object from Redis Hash
    async getRole(roleId) {
        const key = `role:${roleId}`;
        try {
            const data = await this.redis.hgetall(key);
            if (!Object.keys(data).length) {
                return null;
            }
            return {
                roleID: roleId,
                name: data.name,
                description: data.description,
                Permissions: JSON.parse(data.permissions || '[]')
            };
        } catch (error) {
            logger.error(`Failed to retrieve role data from Redis: ${roleId}`, { error: error.message, service: 'redis' });
            return null;
        }
    }

    // Retrieve all roles from Redis
    async getAllRoles() {
        try {
            const keys = await this.redis.keys('role:*');
            const roles = [];
            for (const key of keys) {
                const data = await this.redis.hgetall(key);
                if (Object.keys(data).length) {
                    roles.push({
                        roleID: key.split(':')[1],
                        name: data.name,
                        description: data.description,
                        Permissions: JSON.parse(data.permissions || '[]')
                    });
                }
            }
            return roles;
        } catch (error) {
            logger.error('Failed to retrieve all roles from Redis', { error: error.message, service: 'redis' });
            return [];
        }
    }

    // Delete role from Redis
    async deleteRole(roleId) {
        const key = `role:${roleId}`;
        try {
            await this.redis.del(key);
            logger.info(`Deleted role from Redis: ${roleId}`, { service: 'redis' });
        } catch (error) {
            logger.error(`Failed to delete role from Redis: ${roleId}`, { error: error.message, service: 'redis' });
            throw error;
        }
    }

    // Publish event to Redis Pub/Sub channel
    async publishEvent(channel, data) {
        try {
            await this.redis.publish(channel, JSON.stringify(data));
            logger.info(`Published event to ${channel}`, { service: 'redis', metadata: { data } });
        } catch (error) {
            logger.error(`Failed to publish event to ${channel}`, { error: error.message, service: 'redis' });
            throw error;
        }
    }

    // Add a visitor to a Redis Set
    async addVisitor(visitorId) {
        const key = 'visitors';
        try {
            await this.redis.sadd(key, visitorId);
            await this.redis.expire(key, 86400); // 1 day TTL
            logger.info(`Added visitor to Redis Set: ${visitorId}`, { service: 'redis' });
        } catch (error) {
            logger.error(`Failed to add visitor to Redis: ${visitorId}`, { error: error.message, service: 'redis' });
            throw error;
        }
    }

    // Get all unique visitors from Redis Set
    async getVisitors() {
        const key = 'visitors';
        try {
            const visitors = await this.redis.smembers(key);
            return visitors;
        } catch (error) {
            logger.error('Failed to retrieve visitors from Redis', { error: error.message, service: 'redis' });
            return [];
        }
    }

    // Remove a visitor from Redis Set
    async removeVisitor(visitorId) {
        const key = 'visitors';
        try {
            await this.redis.srem(key, visitorId);
            logger.info(`Removed visitor from Redis Set: ${visitorId}`, { service: 'redis' });
        } catch (error) {
            logger.error(`Failed to remove visitor from Redis: ${visitorId}`, { error: error.message, service: 'redis' });
            throw error;
        }
    }
}

module.exports = new RedisUtils();