const PermissionService = require('../services/permissionService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing permission-related operations with structured logging.
 */
class PermissionController {
    // --- Permission Retrieval Methods ---

    /**
     * Get all permissions.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with permissions or error.
     */
    static async getAllPermissions(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const permissions = await PermissionService.getAllPermissions();
            logger.info('Successfully fetched all permissions', {
                route: 'permissions',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { permissionCount: permissions.length }
            });
            return res.status(200).json(permissions);
        } catch (error) {
            logger.error('Failed to fetch permissions', {
                route: 'permissions',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Failed to fetch permissions' });
        }
    }

    /**
     * Get a permission by ID.
     * @param {Object} req - Express request object with permissionID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with permission or error.
     */
    static async getPermissionById(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { permissionID } = req.params;
            if (!permissionID) {
                logger.warn('Get permission failed: Missing permissionID', {
                    route: 'permissions',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Permission ID is required' });
            }
            const permission = await PermissionService.getPermissionById(permissionID);
            logger.info('Successfully fetched permission', {
                route: 'permissions',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { permissionID }
            });
            return res.status(200).json(permission);
        } catch (error) {
            logger.error('Failed to fetch permission', {
                route: 'permissions',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(404).json({ error: 'Permission not found' });
        }
    }

    /**
     * Get permissions for a role.
     * @param {Object} req - Express request object with roleID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with permissions or error.
     */
    static async getPermissionsByRole(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { roleID } = req.params;
            if (!roleID) {
                logger.warn('Get role permissions failed: Missing roleID', {
                    route: 'permissions/role',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Role ID is required' });
            }
            const permissions = await PermissionService.getPermissionsByRole(roleID);
            logger.info('Successfully fetched permissions for role', {
                route: 'permissions/role',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { roleID, permissionCount: permissions.length }
            });
            return res.status(200).json(permissions);
        } catch (error) {
            logger.error('Failed to fetch role permissions', {
                route: 'permissions/role',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(404).json({ error: 'Role permissions not found' });
        }
    }

    /**
     * Get effective permissions for a user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with permissions or error.
     */
    static async getEffectivePermissions(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn('Get effective permissions failed: Missing userID', {
                    route: 'permissions/effective',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'User ID is required' });
            }
            const permissions = await PermissionService.getEffectivePermissions(userID);
            logger.info('Successfully fetched effective permissions for user', {
                route: 'permissions/effective',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID, permissionCount: permissions.length }
            });
            return res.status(200).json(permissions);
        } catch (error) {
            logger.error('Failed to fetch effective permissions', {
                route: 'permissions/effective',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(404).json({ error: 'Effective permissions not found' });
        }
    }

    /**
     * Get permission overrides for a user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with overrides or error.
     */
    static async getPermissionOverrides(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn('Get permission overrides failed: Missing userID', {
                    route: 'permissions/overrides',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'User ID is required' });
            }
            const overrides = await PermissionService.getPermissionOverrides(userID);
            logger.info('Successfully fetched permission overrides for user', {
                route: 'permissions/overrides',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID, overrideCount: overrides.length }
            });
            return res.status(200).json(overrides);
        } catch (error) {
            logger.error('Failed to fetch permission overrides', {
                route: 'permissions/overrides',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(404).json({ error: 'Permission overrides not found' });
        }
    }

    // --- Permission Modification Methods ---

    /**
     * Update a permission.
     * @param {Object} req - Express request object with permissionID in params and data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with updated permission or error.
     */
    static async updatePermission(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { permissionID } = req.params;
            const { className, description } = req.body;
            if (!permissionID) {
                logger.warn('Update permission failed: Missing permissionID', {
                    route: 'permissions',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Permission ID is required' });
            }
            const permission = await PermissionService.updatePermission(permissionID, { className, description }, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'permission:updated',
                data: { permissionID, className },
                metadata: { updatedBy: req.user.email }
            });
            logger.info('Successfully updated permission', {
                route: 'permissions',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { permissionID }
            });
            return res.status(200).json(permission);
        } catch (error) {
            logger.error('Failed to update permission', {
                route: 'permissions',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(400).json({ error: error.message });
        }
    }

    /**
     * Assign permissions to a role.
     * @param {Object} req - Express request object with roleID in params and permissionIDs in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async assignPermissionsToRole(req, res) {
        console.log(req.body);
        const actorID = req.user?.userID || 'unknown';
        try {
            const { roleID } = req.params;
            let { permissionIDs } = req.body;

            if (typeof permissionIDs === 'string') {
                permissionIDs = permissionIDs.split(',').map(id => id.trim()).filter(id => id);
            }

            if (!roleID || !Array.isArray(permissionIDs) || permissionIDs.length === 0) {
                logger.warn('Assign permissions failed: Invalid input', {
                    route: 'permissions/assign',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { roleID, permissionIDs }
                });
                return res.status(400).json({ error: 'Role ID and at least one permission ID are required' });
            }

            const result = await PermissionService.assignPermissionsToRole(req.user, roleID, permissionIDs, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'permission:assigned',
                data: { roleID, permissionIDs },
                metadata: { assignedBy: req.user.email }
            });
            logger.info('Successfully assigned permissions to role', {
                route: 'permissions/assign',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { roleID, permissionCount: permissionIDs.length }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to assign permissions', {
                route: 'permissions/assign',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(400).json({ error: error.message });
        }
    }

    /**
     * Revoke permissions from a role.
     * @param {Object} req - Express request object with roleID in params and permissionIDs in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async revokePermissionsFromRole(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { roleID } = req.params;
            const { permissionIDs } = req.body;
            if (!roleID || !Array.isArray(permissionIDs)) {
                logger.warn('Revoke permissions failed: Invalid input', {
                    route: 'permissions/revoke',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { roleID }
                });
                return res.status(400).json({ error: 'Role ID and permission IDs are required' });
            }
            const result = await PermissionService.revokePermissionsFromRole(roleID, permissionIDs, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'permission:revoked',
                data: { roleID, permissionIDs },
                metadata: { revokedBy: req.user.email }
            });
            logger.info('Successfully revoked permissions from role', {
                route: 'permissions/revoke',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { roleID, permissionCount: permissionIDs.length }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to revoke permissions', {
                route: 'permissions/revoke',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(400).json({ error: error.message });
        }
    }

    /**
     * Add a permission override for a user.
     * @param {Object} req - Express request object with userID in params and override data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with override or error.
     */
    static async addPermissionOverride(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { userID } = req.params;
            const { roleID, permissionID, action } = req.body;
            if (!userID || !roleID || !permissionID || !['grant', 'revoke'].includes(action)) {
                logger.warn('Add permission override failed: Invalid input', {
                    route: 'permissions/override',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { userID, roleID, permissionID, action }
                });
                return res.status(400).json({ error: 'User ID, role ID, permission ID, and action are required' });
            }
            const override = await PermissionService.addPermissionOverride(req.user, userID, roleID, permissionID, action, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'permission:override_added',
                data: { userID, roleID, permissionID, action },
                metadata: { addedBy: req.user.email }
            });
            logger.info('Successfully added permission override', {
                route: 'permissions/override',
                method: req.method,
                url: req.originalUrl,
                status: 201,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID, roleID, permissionID, action }
            });
            return res.status(201).json(override);
        } catch (error) {
            logger.error('Failed to add permission override', {
                route: 'permissions/override',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(400).json({ error: error.message });
        }
    }

    /**
     * Remove a permission override.
     * @param {Object} req - Express request object with overrideID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async removePermissionOverride(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { overrideID } = req.params;
            if (!overrideID) {
                logger.warn('Remove permission override failed: Missing overrideID', {
                    route: 'permissions/override',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Override ID is required' });
            }
            const result = await PermissionService.removePermissionOverride(overrideID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'permission:override_removed',
                data: { overrideID },
                metadata: { removedBy: req.user.email }
            });
            logger.info('Successfully removed permission override', {
                route: 'permissions/override',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { overrideID }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to remove permission override', {
                route: 'permissions/override',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(400).json({ error: error.message });
        }
    }
}

module.exports = PermissionController;