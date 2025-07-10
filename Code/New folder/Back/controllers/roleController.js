const { validationResult } = require('express-validator');
const RoleService = require('../services/roleService');
const NotificationService = require('../services/notificationService');
const { getRedisClient } = require('../config/redis');
const RedisUtils = require('../utils/redisUtils');
const cache = require('../utils/cache');
const { Role, User } = require('../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { logRequest } = require('../utils/controllerUtils');
const { sequelize } = require('../config/db');
const Sequelize = require('sequelize');

const ERROR_MESSAGES = {
    MISSING_FIELDS: 'Please fill in all required fields.',
    ROLE_NOT_FOUND: 'Role not found.',
    USER_NOT_FOUND: 'User not found.',
    INVALID_ROLE_IDS: 'Invalid or empty role IDs array.',
    SERVER_ERROR: 'Something broke. Try again later.',
};

class RoleController {
    static formatError(error) {
        return {
            error: error.message || ERROR_MESSAGES.SERVER_ERROR,
            details: error.details || undefined,
        };
    }

    static async getAllRoles(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

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
                defaultRoute: 'roles',
            });

            return res.status(200).json(roles);
        } catch (error) {
            const response = RoleController.formatError(error);
            const status = error.status || 500;

            logRequest({
                req,
                error,
                status,
                message: `Failed to retrieve roles: ${response.error}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles',
            });

            return res.status(status).json(response);
        }
    }

    static async getRoleById(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { roleID } = req.params;
            if (!roleID) {
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400 });
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
                defaultRoute: 'roles',
            });

            return res.status(200).json(role);
        } catch (error) {
            const response = RoleController.formatError(error);
            const status = error.status || 404;

            logRequest({
                req,
                error,
                status,
                message: `Failed to retrieve role: ${response.error}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles',
            });

            return res.status(status).json(response);
        }
    }

    static async getRolesByUser(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { userID } = req.params;
            if (!userID) {
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400 });
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
                metadata: { userID, roleCount: roles.length },
                service: 'role',
                defaultRoute: 'roles',
            });

            return res.status(200).json(roles);
        } catch (error) {
            const response = RoleController.formatError(error);
            const status = error.status || 404;

            logRequest({
                req,
                error,
                status,
                message: `Failed to retrieve user roles: ${response.error}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles',
            });

            return res.status(status).json(response);
        }
    }

    static async createRole(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                await transaction.rollback();
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { name, description } = req.body;
            if (!name) {
                await transaction.rollback();
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400 });
            }

            const actorID = req.user?.userID || 'unknown';
            const role = await RoleService.createRole(name, description, actorID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('roles');
            await cacheInstance.invalidate('roles:all');
            await redis.set('roles:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'roles');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'role:created',
                data: { roleID: role.roleID, name, description },
                metadata: { triggeredBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: actorID,
                type: 'role',
                customMessage: `Role ${name} created`,
                requestID,
            });

            logRequest({
                req,
                res: role,
                status: 201,
                message: `Created role ${name}`,
                level: 'info',
                metadata: { roleID: role.roleID, name, createdBy: req.user?.email, requestID },
                service: 'role',
                defaultRoute: 'roles',
            });

            await transaction.commit();
            return res.status(201).json(role);
        } catch (error) {
            await transaction.rollback();
            const response = RoleController.formatError(error);
            const status = error.status || 400;

            logRequest({
                req,
                error,
                status,
                message: `Failed to create role: ${response.error}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles',
            });

            return res.status(status).json(response);
        }
    }

    static async updateRole(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                await transaction.rollback();
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { roleID } = req.params;
            const { name, description } = req.body;
            if (!roleID) {
                await transaction.rollback();
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400 });
            }

            const actorID = req.user?.userID || 'unknown';
            const role = await RoleService.updateRole(roleID, { name, description }, actorID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('roles');
            await cacheInstance.invalidate('roles:all');
            await cacheInstance.invalidate(`role:${roleID}`);
            await redis.set('roles:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'roles');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'role:updated',
                data: { roleID, name: role.name, description: role.description },
                metadata: { triggeredBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: actorID,
                type: 'role',
                customMessage: `Role ${role.name} updated`,
                requestID,
            });

            logRequest({
                req,
                res: role,
                status: 200,
                message: `Updated role ${roleID}`,
                level: 'info',
                metadata: { roleID, name: role.name, updatedBy: req.user?.email, requestID },
                service: 'role',
                defaultRoute: 'roles',
            });

            await transaction.commit();
            return res.status(200).json(role);
        } catch (error) {
            await transaction.rollback();
            const response = RoleController.formatError(error);
            const status = error.status || 400;

            logRequest({
                req,
                error,
                status,
                message: `Failed to update role: ${response.error}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles',
            });

            return res.status(status).json(response);
        }
    }

    static async deleteRole(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                await transaction.rollback();
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { roleID } = req.params;
            if (!roleID) {
                await transaction.rollback();
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400 });
            }

            const actorID = req.user?.userID || 'unknown';
            const role = await Role.findByPk(roleID);
            await RoleService.deleteRole(roleID, actorID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('roles');
            await cacheInstance.invalidate('roles:all');
            await cacheInstance.invalidate(`role:${roleID}`);
            await redis.set('roles:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'roles');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'role:deleted',
                data: { roleID },
                metadata: { triggeredBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: actorID,
                type: 'role',
                customMessage: `Role ${role.name} deleted`,
                requestID,
            });

            const response = { message: 'Role deleted successfully' };

            logRequest({
                req,
                res: response,
                status: 200,
                message: `Deleted role ${roleID}`,
                level: 'info',
                metadata: { roleID, deletedBy: req.user?.email, requestID },
                service: 'role',
                defaultRoute: 'roles',
            });

            await transaction.commit();
            return res.status(200).json(response);
        } catch (error) {
            await transaction.rollback();
            const response = RoleController.formatError(error);
            const status = error.status || 400;

            logRequest({
                req,
                error,
                status,
                message: `Failed to delete role: ${response.error}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles',
            });

            return res.status(status).json(response);
        }
    }

    static async assignRolesToUser(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                await transaction.rollback();
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { userID } = req.params;
            const { roleIDs } = req.body;
            if (!userID || !Array.isArray(roleIDs) || roleIDs.length === 0) {
                await transaction.rollback();
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_ROLE_IDS), { status: 400 });
            }

            const actorID = req.user?.userID || 'unknown';
            const result = await RoleService.assignRolesToUser(userID, roleIDs, actorID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await RedisUtils.invalidateUser(userID);
            await cacheInstance.invalidateByTag(['users', 'roles']);
            await cacheInstance.invalidate('roles:all');
            await cacheInstance.invalidate(`user:${userID}:roles`);
            await cacheInstance.invalidateByTag('users');
            await redis.set('roles:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'roles');

            const roles = await Role.findAll({
                where: { roleID: { [Op.in]: roleIDs } },
                attributes: ['name'],
                transaction,
            });
            const roleNames = roles.map(role => role.name).join(', ');
            const user = await User.findByPk(userID, { transaction });

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'role:assigned',
                data: { userID, roleIDs, roleNames },
                metadata: { triggeredBy: req.user?.email || 'unknown' },
                dynamicRecipients: [userID],
                triggeredByUserID: actorID,
                type: 'user',
                customMessage: `Assigned roles ${roleNames} to user ${user.firstname} ${user.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 201,
                message: `Assigned roles to user ${userID}`,
                level: 'info',
                metadata: { userID, roleCount: roleIDs.length, roleNames, requestID },
                service: 'role',
                defaultRoute: 'roles',
            });

            await transaction.commit();
            return res.status(201).json({ userID, roleIDs });
        } catch (error) {
            await transaction.rollback();
            const response = RoleController.formatError(error);
            const status = error.status || 400;

            logRequest({
                req,
                error,
                status,
                message: `Failed to assign roles: ${response.error}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles',
            });

            return res.status(status).json(response);
        }
    }

    static async revokeRolesFromUser(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                await transaction.rollback();
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { userID } = req.params;
            const { roleIDs } = req.body;
            if (!userID || !Array.isArray(roleIDs) || roleIDs.length === 0) {
                await transaction.rollback();
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_ROLE_IDS), { status: 400 });
            }

            const actorID = req.user?.userID || 'unknown';
            const result = await RoleService.revokeRolesFromUser(userID, roleIDs, actorID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await RedisUtils.invalidateUser(userID);
            await cacheInstance.invalidateByTag(['users', 'roles']);
            await cacheInstance.invalidate('roles:all');
            await cacheInstance.invalidate(`user:${userID}:roles`);
            await cacheInstance.invalidateByTag('users');
            await redis.set('roles:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'roles');

            const roles = await Role.findAll({
                where: { roleID: { [Op.in]: roleIDs } },
                attributes: ['name'],
                transaction,
            });
            const roleNames = roles.map(role => role.name).join(', ');
            const user = await User.findByPk(userID);

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'role:revoked',
                data: { userID, roleIDs, roleNames },
                metadata: { triggeredBy: req.user?.email || 'unknown' },
                dynamicRecipients: [userID],
                triggeredByUserID: actorID,
                type: 'user',
                customMessage: `Revoked roles ${roleNames} from user ${user.firstname} ${user.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Revoked roles from user ${userID}`,
                level: 'info',
                metadata: { userID, roleCount: roleIDs.length, roleNames, requestID },
                service: 'role',
                defaultRoute: 'roles',
            });

            await transaction.commit();
            return res.status(200).json({ userID, roleIDs });
        } catch (error) {
            await transaction.rollback();
            const response = RoleController.formatError(error);
            const status = error.status || 400;

            logRequest({
                req,
                error,
                status,
                message: `Failed to revoke roles: ${response.error}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles',
            });

            return res.status(status).json(response);
        }
    }

    static async resetMainRoles(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                await transaction.rollback();
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const actorID = req.user?.userID || 'unknown';
            const user = await User.findByPk(actorID);
            const result = await RoleService.resetMainRolesToDefault(actorID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('roles');
            await cacheInstance.invalidate('roles:all');
            await redis.set('roles:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'roles');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'role:reset',
                data: { roleCount: result.length },
                metadata: { triggeredBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: actorID,
                type: 'role',
                customMessage: `Main roles reset by user ${user.firstname} ${user.lastname}`,
                requestID,
            });

            const response = { message: 'Main roles reset successfully', details: result };

            logRequest({
                req,
                res: response,
                status: 200,
                message: `Reset main roles`,
                level: 'info',
                metadata: { roleCount: result.length, resetBy: req.user?.email, requestID },
                service: 'role',
                defaultRoute: 'roles',
            });

            await transaction.commit();
            return res.status(200).json(response);
        } catch (error) {
            await transaction.rollback();
            const response = RoleController.formatError(error);
            const status = error.status || 500;

            logRequest({
                req,
                error,
                status,
                message: `Failed to reset roles: ${response.error}`,
                level: 'error',
                service: 'role',
                defaultRoute: 'roles',
            });

            return res.status(status).json(response);
        }
    }
}

module.exports = RoleController;