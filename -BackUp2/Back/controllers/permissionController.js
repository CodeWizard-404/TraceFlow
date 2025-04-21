const PermissionService = require('../services/permissionService');
const logger = require('../utils/logger');

class PermissionController {
    static async getAllPermissions(req, res) {
        try {
            const permissions = await PermissionService.getAllPermissions();
            logger.info(`Fetched all permissions by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(permissions);
        } catch (error) {
            logger.error(`Fetch permissions error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(500).json({ error: error.message || 'Could not fetch permissions.' });
        }
    }

    static async getPermissionById(req, res) {
        try {
            const { permissionID } = req.params;
            if (!permissionID) {
                logger.warn(`Get permission failed: Missing permissionID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Permission ID is required.' });
            }
            const permission = await PermissionService.getPermissionById(permissionID);
            logger.info(`Fetched permission ${permissionID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(permission);
        } catch (error) {
            logger.error(`Get permission error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(404).json({ error: error.message || 'Permission not found.' });
        }
    }

    static async updatePermission(req, res) {
        try {
            const { permissionID } = req.params;
            const { className, description } = req.body;
            if (!permissionID) {
                logger.warn(`Update permission failed: Missing permissionID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Permission ID is required.' });
            }
            const permission = await PermissionService.updatePermission(permissionID, { className, description }, req.user.userID);
            logger.info(`Updated permission ${permissionID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(permission);
        } catch (error) {
            logger.error(`Update permission error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message || 'Could not update permission.' });
        }
    }

    static async assignPermissionsToRole(req, res) {
        try {
            const { roleID } = req.params;
            const { permissionIDs } = req.body;
            if (!roleID || !Array.isArray(permissionIDs)) {
                logger.warn(`Assign permissions failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Role ID and permission IDs are required.' });
            }
            const result = await PermissionService.assignPermissionsToRole(req.user, roleID, permissionIDs, req.user.userID);
            logger.info(`Assigned permissions to role ${roleID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Assign permissions error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message || 'Could not assign permissions to role.' });
        }
    }

    static async revokePermissionsFromRole(req, res) {
        try {
            const { roleID } = req.params;
            const { permissionIDs } = req.body;
            if (!roleID || !Array.isArray(permissionIDs)) {
                logger.warn(`Revoke permissions failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Role ID and permission IDs are required.' });
            }
            const result = await PermissionService.revokePermissionsFromRole(roleID, permissionIDs, req.user.userID);
            logger.info(`Revoked permissions from role ${roleID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Revoke permissions error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message || 'Could not revoke permissions from role.' });
        }
    }

    static async getPermissionsByRole(req, res) {
        try {
            const { roleID } = req.params;
            if (!roleID) {
                logger.warn(`Get role permissions failed: Missing roleID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Role ID is required.' });
            }
            const permissions = await PermissionService.getPermissionsByRole(roleID);
            logger.info(`Fetched permissions for role ${roleID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(permissions);
        } catch (error) {
            logger.error(`Get role permissions error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(404).json({ error: error.message || 'Role not found.' });
        }
    }

    static async addPermissionOverride(req, res) {
        try {
            const { userID } = req.params;
            const { roleID, permissionID, action } = req.body;
            if (!userID || !roleID || !permissionID || !['grant', 'revoke'].includes(action)) {
                logger.warn(`Add permission override failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'User ID, role ID, permission ID, and action are required.' });
            }
            const override = await PermissionService.addPermissionOverride(req.user, userID, roleID, permissionID, action, req.user.userID);
            logger.info(`Added permission override for user ${userID} by ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(201).json(override);
        } catch (error) {
            logger.error(`Add permission override error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message || 'Could not add permission override.' });
        }
    }

    static async removePermissionOverride(req, res) {
        try {
            const { overrideID } = req.params;
            if (!overrideID) {
                logger.warn(`Remove permission override failed: Missing overrideID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Override ID is required.' });
            }
            const result = await PermissionService.removePermissionOverride(overrideID, req.user.userID);
            logger.info(`Removed permission override ${overrideID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Remove permission override error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message || 'Could not remove permission override.' });
        }
    }

    static async getEffectivePermissions(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Get effective permissions failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'User ID is required.' });
            }
            const permissions = await PermissionService.getEffectivePermissions(userID);
            logger.info(`Fetched effective permissions for user ${userID} by ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(permissions);
        } catch (error) {
            logger.error(`Get effective permissions error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(404).json({ error: error.message || 'Could not fetch effective permissions.' });
        }
    }

    static async getPermissionOverrides(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Get permission overrides failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'User ID is required.' });
            }
            const overrides = await PermissionService.getPermissionOverrides(userID);
            logger.info(`Fetched permission overrides for user ${userID} by ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(overrides);
        } catch (error) {
            logger.error(`Get permission overrides error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(404).json({ error: error.message || 'Could not fetch permission overrides.' });
        }
    }
}

module.exports = PermissionController;