const RoleService = require('../services/roleService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const { getRedisClient } = require('../config/redis');
const RedisUtils = require('../utils/redisUtils');
const cache = require('../utils/cache');
const { Role } = require('../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { logRequest } = require('../utils/controllerUtils');


class RoleController {
    static async getAllRoles(req, res) {
        try {
            const cacheInstance = await cache();
            const redis = getRedisClient();
            const cacheKey = 'roles:all';
            const lastUpdatedKey = 'roles:last_updated';

            const lastUpdated = await redis.get(lastUpdatedKey);
            const now = Date.now();
            const cacheTTL = 300000;
            const isStale = lastUpdated && (now - parseInt(lastUpdated) > cacheTTL);

            if (isStale) {
                await cacheInstance.invalidate(cacheKey);
                await redis.set(lastUpdatedKey, now.toString());
                logger.debug(`Invalidated stale cache for ${cacheKey} due to timestamp`);
            }

            const roles = await cacheInstance.getOrSet(cacheKey, async () => {
                const freshRoles = await RoleService.getAllRoles();
                await redis.set(lastUpdatedKey, now.toString());
                return freshRoles;
            }, 'api');

            logRequest({
                req,
                res: roles,
                status: 200,
                message: `Retrieved ${roles.length} roles`,
                level: 'info',
                metadata: { roleCount: roles.length, cacheHit: !isStale },
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(200).json(roles);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to retrieve roles: ${error.message}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(500).json({ error: 'Failed to retrieve roles' });
        }
    }

    static async getRoleById(req, res) {
        try {
            const { roleID } = req.params;
            if (!roleID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Role ID is required',
                    level: 'error',
                    service: 'role',
                    defaultRoute: 'roles'
                });
                return res.status(400).json({ error: 'Role ID is required' });
            }

            const cacheInstance = await cache();
            const role = await cacheInstance.getOrSet(`role:${roleID}`, async () => {
                return await RoleService.getRoleById(roleID);
            }, 'api');

            logRequest({
                req,
                res: role,
                status: 200,
                message: `Retrieved role ${roleID}`,
                level: 'info',
                metadata: { roleID, name: role.name },
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(200).json(role);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: `Failed to retrieve role: ${error.message}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(404).json({ error: 'Role not found' });
        }
    }

    static async getRolesByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'User ID is required',
                    level: 'error',
                    service: 'role',
                    defaultRoute: 'roles'
                });
                return res.status(400).json({ error: 'User ID is required' });
            }

            const cacheInstance = await cache();
            const roles = await cacheInstance.getOrSet(`user:${userID}:roles`, async () => {
                return await RoleService.getRolesByUser(userID);
            }, 'api');

            logRequest({
                req,
                res: roles,
                status: 200,
                message: `Retrieved roles for user ${userID}`,
                level: 'info',
                metadata: { roleCount: roles.length },
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(200).json(roles);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: `Failed to retrieve user roles: ${error.message}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(404).json({ error: 'User roles not found' });
        }
    }

    static async createRole(req, res) {
        try {
            const { name, description } = req.body;
            if (!name) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Role name is required',
                    level: 'error',
                    service: 'role',
                    defaultRoute: 'roles'
                });
                return res.status(400).json({ error: 'Role name is required' });
            }

            const role = await RoleService.createRole(name, description, req.user.userID);

            const cacheInstance = await cache();
            await cacheInstance.invalidateByTag('roles');
            await cacheInstance.invalidate('roles:all');
            await getRedisClient().set('roles:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'roles:all');

            await NotificationService.triggerNotification({
                event: 'role:created',
                data: { roleID: role.roleID, name, description },
                metadata: { triggeredBy: req.user.email },
                triggeredByUserID: req.user.userID,
                type: 'role',
                requestID: uuidv4(),
            });

            logRequest({
                req,
                res: role,
                status: 201,
                message: `Created role ${name}`,
                level: 'info',
                metadata: { roleID: role.roleID, name, createdBy: req.user.email },
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(201).json(role);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to create role: ${error.message}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(400).json({ error: error.message || 'Failed to create role' });
        }
    }

    static async updateRole(req, res) {
        try {
            const { roleID } = req.params;
            const { name, description } = req.body;
            if (!roleID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Role ID is required',
                    level: 'error',
                    service: 'role',
                    defaultRoute: 'roles'
                });
                return res.status(400).json({ error: 'Role ID is required' });
            }

            const role = await RoleService.updateRole(roleID, { name, description }, req.user.userID);

            const cacheInstance = await cache();
            await cacheInstance.invalidateByTag('roles');
            await cacheInstance.invalidate('roles:all');
            await cacheInstance.invalidate(`role:${roleID}`);
            await getRedisClient().set('roles:last_updated', Date.now().toString());
            await RedisUtils.invalidateUser(req.user.userID);
            await RedisUtils.publishEvent('cache:invalidate', `role:${roleID}`);
            await RedisUtils.publishEvent('cache:invalidate', 'roles:all');

            await NotificationService.triggerNotification({
                event: 'role:updated',
                data: { roleID, name: role.name, description: role.description },
                metadata: { triggeredBy: req.user.email },
                triggeredByUserID: req.user.userID,
                type: 'role',
                requestID: uuidv4(),
            });

            logRequest({
                req,
                res: role,
                status: 200,
                message: `Updated role ${roleID}`,
                level: 'info',
                metadata: { roleID, name: role.name, updatedBy: req.user.email },
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(200).json(role);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to update role: ${error.message}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(400).json({ error: error.message || 'Failed to update role' });
        }
    }

    static async deleteRole(req, res) {
        try {
            const { roleID } = req.params;
            if (!roleID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Role ID is required',
                    level: 'error',
                    service: 'role',
                    defaultRoute: 'roles'
                });
                return res.status(400).json({ error: 'Role ID is required' });
            }

            await RoleService.deleteRole(roleID, req.user.userID);

            const cacheInstance = await cache();
            await cacheInstance.invalidateByTag('roles');
            await cacheInstance.invalidate('roles:all');
            await cacheInstance.invalidate(`role:${roleID}`);
            await getRedisClient().set('roles:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', `role:${roleID}`);
            await RedisUtils.publishEvent('cache:invalidate', 'roles:all');

            await NotificationService.triggerNotification({
                event: 'role:deleted',
                data: { roleID },
                metadata: { triggeredBy: req.user.email },
                triggeredByUserID: req.user.userID,
                type: 'role',
                requestID: uuidv4(),
            });

            logRequest({
                req,
                res: { message: 'Role deleted successfully' },
                status: 200,
                message: `Deleted role ${roleID}`,
                level: 'info',
                metadata: { roleID, deletedBy: req.user.email },
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(200).json({ message: 'Role deleted successfully' });
        } catch (error) {
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to delete role: ${error.message}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(400).json({ error: error.message || 'Failed to delete role' });
        }
    }

    static async assignRolesToUser(req, res) {
        try {
            const { userID } = req.params;
            const { roleIDs } = req.body;
            if (!userID || !Array.isArray(roleIDs) || roleIDs.length === 0) {
                logRequest({
                    req,
                    status: 400,
                    message: 'User ID and non-empty role IDs array are required',
                    level: 'info',
                    service: 'role',
                    defaultRoute: 'roles'
                });
                return res.status(400).json({ error: 'User ID and non-empty role IDs array are required' });
            }

            const result = await RoleService.assignRolesToUser(userID, roleIDs, req.user.userID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await RedisUtils.invalidateUser(userID);
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidateByTag('roles');
            await cacheInstance.invalidate('roles:all');
            await cacheInstance.invalidate(`user:${userID}:roles`);
            await redis.set('roles:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', `user:${userID}:roles`);
            await RedisUtils.publishEvent('cache:invalidate', 'roles:all');
            await RedisUtils.publishEvent('role:assigned', { userID, roleIDs });

            const roles = await Role.findAll({
                where: { roleID: { [Op.in]: roleIDs } },
                attributes: ['name'],
            });
            const roleNames = roles.map(role => role.name).join(', ');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'role:assigned',
                data: { userID, roleIDs, roleNames },
                metadata: { triggeredBy: req.user.email },
                dynamicRecipients: [userID],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `Assigned roles ${roleNames} to user`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 201,
                message: `Assigned roles to user ${userID}`,
                level: 'info',
                metadata: { userID, roleCount: roleIDs.length, status: true, requestID },
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(201).json(userID);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 400,
                message: `Failed to assign roles: ${error.message}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(400).json({ error: error.message || 'Failed to assign roles' });
        }
    }

    static async revokeRolesFromUser(req, res) {
        try {
            const { userID } = req.params;
            const { roleIDs } = req.body;
            if (!userID || !Array.isArray(roleIDs) || roleIDs.length === 0) {
                logRequest({
                    req,
                    status: 400,
                    message: 'User ID and non-empty role IDs array are required',
                    level: 'info',
                    service: 'role',
                    defaultRoute: 'roles'
                });
                return res.status(400).json({ error: 'User ID and non-empty role IDs array are required' });
            }

            const result = await RoleService.revokeRolesFromUser(userID, roleIDs, req.user.userID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await RedisUtils.invalidateUser(userID);
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidateByTag('roles');
            await cacheInstance.invalidate('roles:all');
            await cacheInstance.invalidate(`user:${userID}:roles`);
            await redis.set('roles:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', `user:${userID}:roles`);
            await RedisUtils.publishEvent('cache:invalidate', 'roles:all');
            await RedisUtils.publishEvent('role:revoked', { userID, roleIDs });

            const roles = await Role.findAll({
                where: { roleID: { [Op.in]: roleIDs } },
                attributes: ['name'],
            });
            const roleNames = roles.map(role => role.name).join(', ');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'role:revoked',
                data: { userID, roleIDs, roleNames },
                metadata: { triggeredBy: req.user.email },
                dynamicRecipients: [userID],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `Revoked roles ${roleNames} from user`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Revoked roles from user ${userID}`,
                level: 'info',
                metadata: { userID, roleCount: roleIDs.length, status: true, requestID },
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(200).json(userID);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 400,
                message: `Failed to revoke roles: ${error.message}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(400).json({ error: error.message || 'Failed to revoke roles' });
        }
    }

    static async resetMainRoles(req, res) {
        try {
            const result = await RoleService.resetMainRolesToDefault(req.user.userID);

            const cacheInstance = await cache();
            await cacheInstance.invalidateByTag('roles');
            await cacheInstance.invalidate('roles:all');
            await getRedisClient().set('roles:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'roles:all');

            await NotificationService.triggerNotification({
                event: 'role:reset',
                data: { roleCount: result.length },
                metadata: { triggeredBy: req.user.email },
                triggeredByUserID: req.user.userID,
                type: 'role',
                requestID: uuidv4(),
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Reset main roles`,
                level: 'info',
                metadata: { roleCount: result.length, resetBy: req.user.email },
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(200).json({
                message: 'Main roles reset successfully',
                details: result,
            });
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to reset roles: ${error.message}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles'
            });

            return res.status(500).json({ error: 'Failed to reset roles' });
        }
    }
}

module.exports = RoleController;