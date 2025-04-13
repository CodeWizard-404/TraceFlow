const RoleService = require('../services/roleService');
const logger = require('../utils/logger');

class RoleController {
    // Create a new role
    static async createRole(req, res) {
        try {
            const { name, description } = req.body;
            if (!name) {
                logger.warn(`Create role failed: Missing name, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Role name is required.' });
            }
            const role = await RoleService.createRole(name, description, req.user.userID);
            logger.info(`Role created: ${name} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(201).json(role);
        } catch (error) {
            logger.error(`Create role error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message || 'Could not create role.' });
        }
    }

    // Get all roles
    static async getAllRoles(req, res) {
        try {
            const roles = await RoleService.getAllRoles();
            logger.info(`Fetched all roles by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(roles);
        } catch (error) {
            logger.error(`Fetch roles error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(500).json({ error: error.message || 'Could not fetch roles.' });
        }
    }

    // Get role by ID
    static async getRoleById(req, res) {
        try {
            const { roleID } = req.params;
            if (!roleID) {
                logger.warn(`Get role failed: Missing roleID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Role ID is required.' });
            }
            const role = await RoleService.getRoleById(roleID);
            logger.info(`Fetched role ${roleID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(role);
        } catch (error) {
            logger.error(`Get role error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(404).json({ error: error.message || 'Role not found.' });
        }
    }

    // Update a role
    static async updateRole(req, res) {
        try {
            const { roleID } = req.params;
            const { name, description } = req.body;
            if (!roleID) {
                logger.warn(`Update role failed: Missing roleID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Role ID is required.' });
            }
            const role = await RoleService.updateRole(roleID, { name, description }, req.user.userID);
            logger.info(`Updated role ${roleID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(role);
        } catch (error) {
            logger.error(`Update role error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message || 'Could not update role.' });
        }
    }

    // Delete a role
    static async deleteRole(req, res) {
        try {
            const { roleID } = req.params;
            if (!roleID) {
                logger.warn(`Delete role failed: Missing roleID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Role ID is required.' });
            }
            await RoleService.deleteRole(roleID, req.user.userID);
            logger.info(`Deleted role ${roleID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json({ message: 'Role deleted successfully.' });
        } catch (error) {
            logger.error(`Delete role error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message || 'Could not delete role.' });
        }
    }

    // Assign roles to a user
    static async assignRolesToUser(req, res) {
        try {
            const { userID } = req.params;
            const { roleIDs } = req.body;
            if (!userID || !Array.isArray(roleIDs)) {
                logger.warn(`Assign roles failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'User ID and role IDs are required.' });
            }
            const result = await RoleService.assignRolesToUser(userID, roleIDs, req.user.userID);
            logger.info(`Assigned roles to user ${userID} by ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Assign roles error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message || 'Could not assign roles.' });
        }
    }

    // Revoke roles from a user
    static async revokeRolesFromUser(req, res) {
        try {
            const { userID } = req.params;
            const { roleIDs } = req.body;
            if (!userID || !Array.isArray(roleIDs) || roleIDs.length === 0) {
                logger.warn(`Revoke roles failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'User ID and role IDs are required.' });
            }
            const result = await RoleService.revokeRolesFromUser(userID, roleIDs, req.user.userID);
            logger.info(`Revoked roles from user ${userID} by ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Revoke roles error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message || 'Could not revoke roles.' });
        }
    }

    // Get roles for a user
    static async getRolesByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Get user roles failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'User ID is required.' });
            }
            const roles = await RoleService.getRolesByUser(userID);
            logger.info(`Fetched roles for user ${userID} by ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(roles);
        } catch (error) {
            logger.error(`Get user roles error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(404).json({ error: error.message || 'Could not fetch user roles.' });
        }
    }

    // Reset main roles
    static async resetMainRoles(req, res) {
        try {
            const result = await RoleService.resetMainRolesToDefault(req.user.userID);
            logger.info(`Reset main roles by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json({
                message: 'Main roles reset successfully.',
                details: result,
            });
        } catch (error) {
            logger.error(`Reset roles error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(500).json({ error: error.message || 'Could not reset roles.' });
        }
    }
}

module.exports = RoleController;