const RoleService = require('../services/roleService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');


/**
 * Controller for managing role-related operations with structured logging and rule-based notifications.
 */
class RoleController {
    // --- Role Retrieval Methods ---

    /**
     * Retrieves all roles from the system.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} Responds with a JSON array of roles or an error.
     */
    static async getAllRoles(req, res) {
        try {
            const roles = await RoleService.getAllRoles();

            logger.info(`All roles retrieved successfully by user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: {
                    roleCount: roles.length,
                    roles: roles.slice(0, 2).map(r => ({ roleID: r.roleID, name: r.name }))
                }
            });

            return res.status(200).json(roles);
        } catch (error) {
            const response = { error: 'Failed to retrieve roles' };

            logger.error(`Failed to retrieve roles for user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 500,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { error: response.error }
            });

            return res.status(500).json(response);
        }
    }

    /**
     * Retrieves a specific role by its ID.
     * @param {Object} req - Express request object with roleID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} Responds with the role details or an error.
     */
    static async getRoleById(req, res) {
        try {
            const { roleID } = req.params;
            if (!roleID) {
                const response = { error: 'Role ID is required' };
                logger.error(`Role ID missing for user ${req.user.userID}`, {
                    traceId: req.traceId,
                    route: 'roles',
                    service: 'api',
                    status: 400,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: req.user.userID,
                    metadata: { error: response.error }
                });
                return res.status(400).json(response);
            }

            const role = await RoleService.getRoleById(roleID);

            logger.info(`Role ${roleID} retrieved successfully by user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { roleID, name: role.name }
            });

            return res.status(200).json(role);
        } catch (error) {
            const response = { error: 'Role not found' };
            logger.error(`Failed to retrieve role for user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 404,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { error: response.error }
            });
            return res.status(404).json(response);
        }
    }

    /**
     * Retrieves all roles assigned to a specific user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} Responds with the user's roles or an error.
     */
    static async getRolesByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                const response = { error: 'User ID is required' };
                logger.error(`User ID missing for user ${req.user.userID}`, {
                    traceId: req.traceId,
                    route: 'roles',
                    service: 'api',
                    status: 400,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: req.user.userID,
                    metadata: { error: response.error }
                });
                return res.status(400).json(response);
            }

            const roles = await RoleService.getRolesByUser(userID);

            logger.info(`Roles for user ${userID} retrieved successfully by user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: {
                    roleCount: roles.length,
                    roles: roles.slice(0, 2).map(r => ({ roleID: r.roleID, name: r.name }))
                }
            });

            return res.status(200).json(roles);
        } catch (error) {
            const response = { error: 'User roles not found' };
            logger.error(`Failed to retrieve roles for user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 404,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { error: response.error }
            });
            return res.status(404).json(response);
        }
    }

    // --- Role Modification Methods ---

    /**
     * Creates a new role in the system.
     * @param {Object} req - Express request object with role data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} Responds with the created role or an error.
     */
    static async createRole(req, res) {
        try {
            const { name, description } = req.body;
            if (!name) {
                const response = { error: 'Role name is required' };
                logger.error(`Role name missing for user ${req.user.userID}`, {
                    traceId: req.traceId,
                    route: 'roles',
                    service: 'api',
                    status: 400,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: req.user.userID,
                    metadata: { error: response.error }
                });
                return res.status(400).json(response);
            }

            const role = await RoleService.createRole(name, description, req.user.userID);

            // Trigger rule-based notification
            await NotificationService.triggerNotification({
                event: 'role:created',
                data: { roleID: role.roleID, name, description },
                metadata: { triggeredBy: req.user.email }
            });

            logger.info(`Role ${name} created successfully by user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 201,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                sensitiveFields: ['createdBy'],
                metadata: { roleID: role.roleID, name, createdBy: req.user.email }
            });

            return res.status(201).json(role);
        } catch (error) {
            const response = { error: error.message || 'Failed to create role' };
            logger.error(`Failed to create role for user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 400,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { error: response.error }
            });
            return res.status(400).json(response);
        }
    }

    /**
     * Updates an existing role.
     * @param {Object} req - Express request object with roleID in params and data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} Responds with the updated role or an error.
     */
    static async updateRole(req, res) {
        try {
            const { roleID } = req.params;
            const { name, description } = req.body;
            if (!roleID) {
                const response = { error: 'Role ID is required' };
                logger.error(`Role ID missing for user ${req.user.userID}`, {
                    traceId: req.traceId,
                    route: 'roles',
                    service: 'api',
                    status: 400,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: req.user.userID,
                    metadata: { error: response.error }
                });
                return res.status(400).json(response);
            }

            const role = await RoleService.updateRole(roleID, { name, description }, req.user.userID);

            // Trigger rule-based notification
            await NotificationService.triggerNotification({
                event: 'role:updated',
                data: { roleID, name: role.name, description: role.description },
                metadata: { triggeredBy: req.user.email }
            });

            logger.info(`Role ${roleID} updated successfully by user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                sensitiveFields: ['updatedBy'],
                metadata: { roleID, name: role.name, updatedBy: req.user.email }
            });

            return res.status(200).json(role);
        } catch (error) {
            const response = { error: error.message || 'Failed to update role' };
            logger.error(`Failed to update role for user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 400,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { error: response.error }
            });
            return res.status(400).json(response);
        }
    }

    /**
     * Deletes a role from the system.
     * @param {Object} req - Express request object with roleID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} Responds with a success message or an error.
     */
    static async deleteRole(req, res) {
        try {
            const { roleID } = req.params;
            if (!roleID) {
                const response = { error: 'Role ID is required' };
                logger.error(`Role ID missing for user ${req.user.userID}`, {
                    traceId: req.traceId,
                    route: 'roles',
                    service: 'api',
                    status: 400,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: req.user.userID,
                    metadata: { error: response.error }
                });
                return res.status(400).json(response);
            }

            await RoleService.deleteRole(roleID, req.user.userID);

            // Trigger rule-based notification
            await NotificationService.triggerNotification({
                event: 'role:deleted',
                data: { roleID },
                metadata: { triggeredBy: req.user.email }
            });

            const response = { message: 'Role deleted successfully' };
            logger.info(`Role ${roleID} deleted successfully by user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                sensitiveFields: ['deletedBy'],
                metadata: { roleID, message: response.message, deletedBy: req.user.email }
            });

            return res.status(200).json(response);
        } catch (error) {
            const response = { error: error.message || 'Failed to delete role' };
            logger.error(`Failed to delete role for user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 400,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { error: response.error }
            });
            return res.status(400).json(response);
        }
    }

    /**
     * Assigns roles to a user.
     * @param {Object} req - Express request object with userID in params and roleIDs in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} Responds with the assignment result or an error.
     */
    static async assignRolesToUser(req, res) {
        try {
            const { userID } = req.params;
            const { roleIDs } = req.body;
            if (!userID || !Array.isArray(roleIDs)) {
                const response = { error: 'User ID and role IDs are required' };
                logger.error(`Invalid input for role assignment by user ${req.user.userID}`, {
                    traceId: req.traceId,
                    route: 'roles',
                    service: 'api',
                    status: 400,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: req.user.userID,
                    metadata: { error: response.error }
                });
                return res.status(400).json(response);
            }

            const result = await RoleService.assignRolesToUser(userID, roleIDs, req.user.userID);

            // Trigger rule-based notification
            await NotificationService.triggerNotification({
                event: 'role:assigned',
                data: { userID, roleIDs },
                metadata: { triggeredBy: req.user.email }
            });

            logger.info(`Roles assigned to user ${userID} successfully by user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                sensitiveFields: ['assignedBy'],
                metadata: { userID, roleCount: roleIDs.length, assignedBy: req.user.email }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = { error: error.message || 'Failed to assign roles' };
            logger.error(`Failed to assign roles for user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 400,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { error: response.error }
            });
            return res.status(400).json(response);
        }
    }

    /**
     * Revokes roles from a user.
     * @param {Object} req - Express request object with userID in params and roleIDs in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} Responds with the revocation result or an error.
     */
    static async revokeRolesFromUser(req, res) {
        try {
            const { userID } = req.params;
            const { roleIDs } = req.body;
            if (!userID || !Array.isArray(roleIDs) || roleIDs.length === 0) {
                const response = { error: 'User ID and role IDs are required' };
                logger.error(`Invalid input for role revocation by user ${req.user.userID}`, {
                    traceId: req.traceId,
                    route: 'roles',
                    service: 'api',
                    status: 400,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: req.user.userID,
                    metadata: { error: response.error }
                });
                return res.status(400).json(response);
            }

            const result = await RoleService.revokeRolesFromUser(userID, roleIDs, req.user.userID);

            // Trigger rule-based notification
            await NotificationService.triggerNotification({
                event: 'role:revoked',
                data: { userID, roleIDs },
                metadata: { triggeredBy: req.user.email }
            });

            logger.info(`Roles revoked from user ${userID} successfully by user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                sensitiveFields: ['revokedBy'],
                metadata: { userID, roleCount: roleIDs.length, revokedBy: req.user.email }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = { error: error.message || 'Failed to revoke roles' };
            logger.error(`Failed to revoke roles for user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 400,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { error: response.error }
            });
            return res.status(400).json(response);
        }
    }

    /**
     * Resets main roles to their default configuration.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} Responds with the reset result or an error.
     */
    static async resetMainRoles(req, res) {
        try {
            const result = await RoleService.resetMainRolesToDefault(req.user.userID);

            // Trigger rule-based notification
            await NotificationService.triggerNotification({
                event: 'role:reset',
                data: { roleCount: result.length },
                metadata: { triggeredBy: req.user.email }
            });

            const response = {
                message: 'Main roles reset successfully',
                details: result
            };

            logger.info(`Main roles reset successfully by user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                sensitiveFields: ['resetBy'],
                metadata: { message: response.message, resetBy: req.user.email }
            });

            return res.status(200).json(response);
        } catch (error) {
            const response = { error: 'Failed to reset roles' };
            logger.error(`Failed to reset roles for user ${req.user.userID}`, {
                traceId: req.traceId,
                route: 'roles',
                service: 'api',
                status: 500,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { error: response.error }
            });
            return res.status(500).json(response);
        }
    }
}

module.exports = RoleController;