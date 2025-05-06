const RoleService = require('../services/roleService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing role-related operations.
 */
class RoleController {
    // --- Role Retrieval Methods ---

    /**
     * Get all roles.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with roles or error.
     */
    static async getAllRoles(req, res) {
        try {
            const roles = await RoleService.getAllRoles();
            logger.info(`Fetched all roles by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(roles);
        } catch (error) {
            logger.error(`Fetch roles error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Failed to fetch roles' });
        }
    }

    /**
     * Get a role by ID.
     * @param {Object} req - Express request object with roleID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with role or error.
     */
    static async getRoleById(req, res) {
        try {
            const { roleID } = req.params;
            if (!roleID) {
                logger.warn(`Get role failed: Missing roleID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Role ID is required' });
            }
            const role = await RoleService.getRoleById(roleID);
            logger.info(`Fetched role ${roleID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(role);
        } catch (error) {
            logger.error(`Get role error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(404).json({ error: 'Role not found' });
        }
    }

    /**
     * Get roles for a user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with roles or error.
     */
    static async getRolesByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Get user roles failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const roles = await RoleService.getRolesByUser(userID);
            logger.info(`Fetched roles for user ${userID} by ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(roles);
        } catch (error) {
            logger.error(`Get user roles error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(404).json({ error: 'User roles not found' });
        }
    }

    // --- Role Modification Methods ---

    /**
     * Create a new role.
     * @param {Object} req - Express request object with role data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with created role or error.
     */
    static async createRole(req, res) {
        try {
            const { name, description } = req.body;
            if (!name) {
                logger.warn(`Create role failed: Missing name, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Role name is required' });
            }
            const role = await RoleService.createRole(name, description, req.user.userID);
            // Notify admins of new role
            await NotificationService.triggerNotification({
                event: 'role:created',
                data: { roleID: role.roleID, name },
                metadata: { createdBy: req.user.email }
            });
            logger.info(`Role created: ${name} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(201).json(role);
        } catch (error) {
            logger.error(`Create role error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    /**
     * Update a role.
     * @param {Object} req - Express request object with roleID in params and data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with updated role or error.
     */
    static async updateRole(req, res) {
        try {
            const { roleID } = req.params;
            const { name, description } = req.body;
            if (!roleID) {
                logger.warn(`Update role failed: Missing roleID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Role ID is required' });
            }
            const role = await RoleService.updateRole(roleID, { name, description }, req.user.userID);
            // Notify admins of role update
            await NotificationService.triggerNotification({
                event: 'role:updated',
                data: { roleID, name },
                metadata: { updatedBy: req.user.email }
            });
            logger.info(`Updated role ${roleID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(role);
        } catch (error) {
            logger.error(`Update role error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    /**
     * Delete a role.
     * @param {Object} req - Express request object with roleID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with success message or error.
     */
    static async deleteRole(req, res) {
        try {
            const { roleID } = req.params;
            if (!roleID) {
                logger.warn(`Delete role failed: Missing roleID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Role ID is required' });
            }
            await RoleService.deleteRole(roleID, req.user.userID);
            // Notify admins of role deletion
            await NotificationService.triggerNotification({
                event: 'role:deleted',
                data: { roleID },
                metadata: { deletedBy: req.user.email }
            });
            logger.info(`Deleted role ${roleID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json({ message: 'Role deleted successfully' });
        } catch (error) {
            logger.error(`Delete role error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    /**
     * Assign roles to a user.
     * @param {Object} req - Express request object with userID in params and roleIDs in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async assignRolesToUser(req, res) {
        try {
            const { userID } = req.params;
            const { roleIDs } = req.body;
            if (!userID || !Array.isArray(roleIDs)) {
                logger.warn(`Assign roles failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID and role IDs are required' });
            }
            const result = await RoleService.assignRolesToUser(userID, roleIDs, req.user.userID);
            // Notify user and their manager of role assignment
            await NotificationService.triggerNotification({
                event: 'role:assigned',
                data: { userID, roleIDs },
                metadata: { assignedBy: req.user.email }
            });
            logger.info(`Assigned roles to user ${userID} by ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Assign roles error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    /**
     * Revoke roles from a user.
     * @param {Object} req - Express request object with userID in params and roleIDs in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async revokeRolesFromUser(req, res) {
        try {
            const { userID } = req.params;
            const { roleIDs } = req.body;
            if (!userID || !Array.isArray(roleIDs) || roleIDs.length === 0) {
                logger.warn(`Revoke roles failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID and role IDs are required' });
            }
            const result = await RoleService.revokeRolesFromUser(userID, roleIDs, req.user.userID);
            // Notify user and their manager of role revocation
            await NotificationService.triggerNotification({
                event: 'role:revoked',
                data: { userID, roleIDs },
                metadata: { revokedBy: req.user.email }
            });
            logger.info(`Revoked roles from user ${userID} by ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Revoke roles error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    /**
     * Reset main roles to default.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async resetMainRoles(req, res) {
        try {
            const result = await RoleService.resetMainRolesToDefault(req.user.userID);
            // Notify admins of role reset
            await NotificationService.triggerNotification({
                event: 'role:reset',
                data: {},
                metadata: { resetBy: req.user.email }
            });
            logger.info(`Reset main roles by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json({
                message: 'Main roles reset successfully',
                details: result
            });
        } catch (error) {
            logger.error(`Reset roles error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Failed to reset roles' });
        }
    }
}

module.exports = RoleController;