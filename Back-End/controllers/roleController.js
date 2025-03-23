// controllers/roleController.js
const RoleService = require('../services/roleService');

class RoleController {
    static async createRole(req, res) {
        try {
            const { name, description } = req.body;
            if (!name) {
                return res.status(400).json({ error: 'Role name is required' });
            }
            const role = await RoleService.createRole(name, description);
            res.status(201).json(role);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Create role failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to create role due to an internal error' });
        }
    }

    static async getAllRoles(req, res) {
        try {
            const roles = await RoleService.getAllRoles();
            res.status(200).json(roles);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get all roles failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to retrieve roles due to an internal error' });
        }
    }

    static async getRoleById(req, res) {
        try {
            const { roleID } = req.params;
            if (!roleID) {
                return res.status(400).json({ error: 'Role ID is required' });
            }
            const role = await RoleService.getRoleById(roleID);
            res.status(200).json(role);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get role by ID failed:`, error);
            res.status(404).json({ error: error.message || 'Role not found' });
        }
    }

    static async updateRole(req, res) {
        try {
            const { roleID } = req.params;
            const { name, description } = req.body;
            if (!roleID) {
                return res.status(400).json({ error: 'Role ID is required' });
            }
            const role = await RoleService.updateRole(roleID, { name, description });
            res.status(200).json(role);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Update role failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to update role due to an internal error' });
        }
    }

    static async deleteRole(req, res) {
        try {
            const { roleID } = req.params;
            if (!roleID) {
                return res.status(400).json({ error: 'Role ID is required' });
            }
            await RoleService.deleteRole(roleID);
            res.status(200).json({ message: 'Role deleted successfully' });
        } catch (error) {
            console.error(`${new Date().toISOString()} - Delete role failed:`, error);
            res.status(404).json({ error: error.message || 'Role not found' });
        }
    }




    
    static async assignRolesToUser(req, res) {
        try {
            const { userID } = req.params;
            const { roleIDs } = req.body;
            if (!userID || !Array.isArray(roleIDs)) {
                return res.status(400).json({ error: 'User ID and role IDs array are required' });
            }
            const result = await RoleService.assignRolesToUser(userID, roleIDs);
            res.status(200).json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Assign roles to user failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to assign roles to user due to an internal error' });
        }
    }

    static async revokeRolesFromUser(req, res) { 
        try {
            const { userID } = req.params;
            const { roleIDs } = req.body;
            if (!userID || !Array.isArray(roleIDs) || roleIDs.length === 0) {
                return res.status(400).json({ error: 'User ID and non-empty role IDs array are required' });
            }
            const result = await RoleService.revokeRoleFromUser(userID, roleIDs);
            res.status(200).json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Revoke roles from user failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to revoke roles from user due to an internal error' });
        }
    }

    static async getRolesByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const roles = await RoleService.getRolesByUser(userID);
            res.status(200).json(roles);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get roles by user failed:`, error);
            res.status(404).json({ error: error.message || 'User not found' });
        }
    }
}

module.exports = RoleController;