const PermissionService = require('../services/permissionService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing permission-related operations.
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
        try {
            const permissions = await PermissionService.getAllPermissions();
            logger.info(`Fetched all permissions by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(permissions);
        } catch (error) {
            logger.error(`Fetch permissions error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { permissionID } = req.params;
            if (!permissionID) {
                logger.warn(`Get permission failed: Missing permissionID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Permission ID is required' });
            }
            const permission = await PermissionService.getPermissionById(permissionID);
            logger.info(`Fetched permission ${permissionID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(permission);
        } catch (error) {
            logger.error(`Get permission error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { roleID } = req.params;
            if (!roleID) {
                logger.warn(`Get role permissions failed: Missing roleID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Role ID is required' });
            }
            const permissions = await PermissionService.getPermissionsByRole(roleID);
            logger.info(`Fetched permissions for role ${roleID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(permissions);
        } catch (error) {
            logger.error(`Get role permissions error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Get effective permissions failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const permissions = await PermissionService.getEffectivePermissions(userID);
            // logger.info(`Fetched effective permissions for user ${userID} by ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(permissions);
        } catch (error) {
            logger.error(`Get effective permissions error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Get permission overrides failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const overrides = await PermissionService.getPermissionOverrides(userID);
            logger.info(`Fetched permission overrides for user ${userID} by ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(overrides);
        } catch (error) {
            logger.error(`Get permission overrides error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { permissionID } = req.params;
            const { className, description } = req.body;
            if (!permissionID) {
                logger.warn(`Update permission failed: Missing permissionID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Permission ID is required' });
            }
            const permission = await PermissionService.updatePermission(permissionID, { className, description }, req.user.userID);
            // Notify admins of permission update
            await NotificationService.triggerNotification({
                event: 'permission:updated',
                data: { permissionID, className },
                metadata: { updatedBy: req.user.email }
            });
            logger.info(`Updated permission ${permissionID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(permission);
        } catch (error) {
            logger.error(`Update permission error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { roleID } = req.params;
            let { permissionIDs } = req.body;

            // Normalize permissionIDs to an array if it's a string
            if (typeof permissionIDs === 'string') {
                permissionIDs = permissionIDs.split(',').map(id => id.trim()).filter(id => id);
            }

            // Validate input
            if (!roleID || !Array.isArray(permissionIDs) || permissionIDs.length === 0) {
                logger.warn(`Assign permissions failed: Invalid input (roleID: ${roleID}, permissionIDs: ${permissionIDs}), user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Role ID and at least one permission ID are required' });
            }

            const result = await PermissionService.assignPermissionsToRole(req.user, roleID, permissionIDs, req.user.userID);
            // Notify admins of permission assignment
            await NotificationService.triggerNotification({
                event: 'permission:assigned',
                data: { roleID, permissionIDs },
                metadata: { assignedBy: req.user.email }
            });
            logger.info(`Assigned permissions to role ${roleID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Assign permissions error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { roleID } = req.params;
            const { permissionIDs } = req.body;
            if (!roleID || !Array.isArray(permissionIDs)) {
                logger.warn(`Revoke permissions failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Role ID and permission IDs are required' });
            }
            const result = await PermissionService.revokePermissionsFromRole(roleID, permissionIDs, req.user.userID);
            // Notify admins of permission revocation
            await NotificationService.triggerNotification({
                event: 'permission:revoked',
                data: { roleID, permissionIDs },
                metadata: { revokedBy: req.user.email }
            });
            logger.info(`Revoked permissions from role ${roleID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Revoke permissions error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { userID } = req.params;
            const { roleID, permissionID, action } = req.body;
            if (!userID || !roleID || !permissionID || !['grant', 'revoke'].includes(action)) {
                logger.warn(`Add permission override failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID, role ID, permission ID, and action are required' });
            }
            const override = await PermissionService.addPermissionOverride(req.user, userID, roleID, permissionID, action, req.user.userID);
            // Notify user and their manager of override
            await NotificationService.triggerNotification({
                event: 'permission:override_added',
                data: { userID, roleID, permissionID, action },
                metadata: { addedBy: req.user.email }
            });
            logger.info(`Added permission override for user ${userID} by ${req.user.userID}, IP: ${req.ip}`);
            return res.status(201).json(override);
        } catch (error) {
            logger.error(`Add permission override error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { overrideID } = req.params;
            if (!overrideID) {
                logger.warn(`Remove permission override failed: Missing overrideID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Override ID is required' });
            }
            const result = await PermissionService.removePermissionOverride(overrideID, req.user.userID);
            // Notify user and their manager of override removal
            await NotificationService.triggerNotification({
                event: 'permission:override_removed',
                data: { overrideID },
                metadata: { removedBy: req.user.email }
            });
            logger.info(`Removed permission override ${overrideID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Remove permission override error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }
}

module.exports = PermissionController;