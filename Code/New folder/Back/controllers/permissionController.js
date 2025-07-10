const PermissionService = require('../services/permissionService');
const NotificationService = require('../services/notificationService');
const { sequelize } = require('../config/db');
const Sequelize = require('sequelize');
const { getRedisClient } = require('../config/redis');
const RedisUtils = require('../utils/redisUtils');
const cache = require('../utils/cache');
const { v4: uuidv4 } = require('uuid');
const { logRequest } = require('../utils/controllerUtils');
const { User, Role } = require('../models');


/**
 * Controller for managing permission-related operations with structured logging.
 */
class PermissionController {
    static async getAllPermissions(req, res) {
        try {
            const cacheInstance = await cache();
            const permissions = await cacheInstance.getOrSet('permissions:all', async () => {
                return await PermissionService.getAllPermissions();
            }, 'api');

            logRequest({
                req,
                res: permissions,
                status: 200,
                message: `Retrieved ${permissions.length} permissions`,
                level: 'info',
                metadata: { permissionCount: permissions.length },
                service: 'permission',
                defaultRoute: 'permissions'
            });

            return res.status(200).json(permissions);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch permissions: ${error.message}`,
                level: 'error',
                service: 'permission',
                defaultRoute: 'permissions'
            });
            return res.status(500).json({ error: 'Failed to fetch permissions' });
        }
    }

    static async getPermissionById(req, res) {
        try {
            const { permissionID } = req.params;
            if (!permissionID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Permission ID is required',
                    level: 'info',
                    service: 'permission',
                    defaultRoute: 'permissions'
                });
                return res.status(400).json({ error: 'Permission ID is required' });
            }

            const cacheInstance = await cache();
            const permission = await cacheInstance.getOrSet(`permission:${permissionID}`, async () => {
                return await PermissionService.getPermissionById(permissionID);
            }, 'api');

            logRequest({
                req,
                res: permission,
                status: 200,
                message: `Retrieved permission ${permissionID}`,
                level: 'info',
                metadata: { permissionID },
                service: 'permission',
                defaultRoute: 'permissions'
            });

            return res.status(200).json(permission);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: `Failed to fetch permission: ${error.message}`,
                level: 'error',
                service: 'permission',
                defaultRoute: 'permissions'
            });
            return res.status(404).json({ error: 'Permission not found' });
        }
    }

    static async getPermissionsByRole(req, res) {
        try {
            const { roleID } = req.params;
            if (!roleID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Role ID is required',
                    level: 'info',
                    service: 'permission',
                    defaultRoute: 'permissions'
                });
                return res.status(400).json({ error: 'Role ID is required' });
            }

            const cacheInstance = await cache();
            const permissions = await cacheInstance.getOrSet(`permissions:role:${roleID}`, async () => {
                return await PermissionService.getPermissionsByRole(roleID);
            }, 'api');

            logRequest({
                req,
                res: permissions,
                status: 200,
                message: `Retrieved ${permissions.length} permissions for role ${roleID}`,
                level: 'info',
                metadata: { roleID, permissionCount: permissions.length },
                service: 'permission',
                defaultRoute: 'permissions'
            });

            return res.status(200).json(permissions);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: `Failed to fetch role permissions: ${error.message}`,
                level: 'error',
                service: 'permission',
                defaultRoute: 'permissions'
            });
            return res.status(404).json({ error: 'Role permissions not found' });
        }
    }

    static async getEffectivePermissions(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'User ID is required',
                    level: 'info',
                    service: 'permission',
                    defaultRoute: 'permissions'
                });
                return res.status(400).json({ error: 'User ID is required' });
            }

            const cacheInstance = await cache();
            const permissions = await cacheInstance.getOrSet(`permissions:user:${userID}`, async () => {
                return await PermissionService.getEffectivePermissions(userID);
            }, 'api');

            logRequest({
                req,
                res: permissions,
                status: 200,
                message: `Retrieved ${permissions.length} effective permissions for user ${userID}`,
                level: 'info',
                metadata: { userID, permissionCount: permissions.length },
                service: 'permission',
                defaultRoute: 'permissions'
            });

            return res.status(200).json(permissions);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: `Failed to fetch effective permissions: ${error.message}`,
                level: 'error',
                service: 'permission',
                defaultRoute: 'permissions'
            });
            return res.status(404).json({ error: 'Role-based permissions not found' });
        }
    }

    static async updatePermission(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { permissionID } = req.params;
            const { className, description } = req.body;
            if (!permissionID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Permission ID is required',
                    level: 'info',
                    service: 'permission',
                    defaultRoute: 'permissions'
                });
                return res.status(400).json({ error: 'Permission ID is required' });
            }

            const permission = await PermissionService.updatePermission(permissionID, { className, description }, req.user.userID, { transaction });
            const user = await User.findByPk(req.user.userID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('permissions');
            await cacheInstance.invalidate(`permission:${permissionID}`);
            await redis.set('permissions:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'permissions');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'permission:updated',
                data: { permissionID, className },
                metadata: { updatedBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: req.user?.userID || 'unknown',
                type: 'permission',
                customMessage: `Permission ${permission.name} updated by user ${user.firstame} ${user.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: permission,
                status: 200,
                message: `Updated permission ${permissionID}`,
                level: 'info',
                metadata: { permissionID, className, description, requestID },
                service: 'permission',
                defaultRoute: 'permissions'
            });

            await transaction.commit();
            return res.status(200).json(permission);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to update permission: ${error.message}`,
                level: 'error',
                service: 'permission',
                defaultRoute: 'permissions'
            });
            return res.status(400).json({ error: error.message });
        }
    }

    static async assignPermissionsToRole(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { roleID } = req.params;
            let { permissionIDs } = req.body;

            if (typeof permissionIDs === 'string') {
                permissionIDs = permissionIDs.split(',').map(id => id.trim()).filter(id => id);
            }

            if (!roleID || !Array.isArray(permissionIDs) || permissionIDs.length === 0) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Role ID and at least one permission ID are required',
                    level: 'info',
                    service: 'permission',
                    defaultRoute: 'permissions'
                });
                return res.status(400).json({ error: 'Role ID and at least one permission ID are required' });
            }

            const result = await PermissionService.assignPermissionsToRole(req.user, roleID, permissionIDs, req.user.userID, { transaction });
            const user = await User.findByPk(req.user.userID);
            const role = await Role.findByPk(roleID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('permissions');
            await cacheInstance.invalidate(`permissions:role:${roleID}`);
            await redis.set('permissions:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'permissions');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'permission:assigned',
                data: { roleID, permissionIDs },
                metadata: { assignedBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: req.user?.userID || 'unknown',
                type: 'permission',
                customMessage: `Permissions assigned to role ${role.name} by user ${user.firstame} ${user.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Assigned ${permissionIDs.length} permissions to role ${roleID}`,
                level: 'info',
                metadata: { roleID, permissionCount: permissionIDs.length, requestID },
                service: 'permission',
                defaultRoute: 'permissions'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to assign permissions: ${error.message}`,
                level: 'error',
                service: 'permission',
                defaultRoute: 'permissions'
            });
            return res.status(400).json({ error: error.message });
        }
    }

    static async revokePermissionsFromRole(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { roleID } = req.params;
            const { permissionIDs } = req.body;
            if (!roleID || !Array.isArray(permissionIDs)) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Role ID and permission IDs are required',
                    level: 'info',
                    service: 'permission',
                    defaultRoute: 'permissions'
                });
                return res.status(400).json({ error: 'Role ID and permission IDs are required' });
            }

            const result = await PermissionService.revokePermissionsFromRole(roleID, permissionIDs, req.user.userID, { transaction });
            const user = await User.findByPk(req.user.userID);
            const role = await Role.findByPk(roleID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('permissions');
            await cacheInstance.invalidate(`permissions:role:${roleID}`);
            await redis.set('permissions:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'permissions');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'permission:revoked',
                data: { roleID, permissionIDs },
                metadata: { revokedBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: req.user?.userID || 'unknown',
                type: 'permission',
                customMessage: `Permissions revoked from role ${role.name} by user ${user.firstame} ${user.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Revoked ${permissionIDs.length} permissions from role ${roleID}`,
                level: 'info',
                metadata: { roleID, permissionCount: permissionIDs.length, requestID },
                service: 'permission',
                defaultRoute: 'permissions'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to revoke permissions: ${error.message}`,
                level: 'error',
                service: 'permission',
                defaultRoute: 'permissions'
            });
            return res.status(400).json({ error: error.message });
        }
    }
}

module.exports = PermissionController;