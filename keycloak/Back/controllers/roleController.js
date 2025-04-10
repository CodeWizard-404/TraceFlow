// controllers/roleController.js
const RoleService = require('../services/roleService');

class RoleController {
    static async createRole(req, res) {
        console.log('create role', req.body);
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
        console.log('get all roles', true);
        try {
            const roles = await RoleService.getAllRoles();
            res.status(200).json(roles);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get all roles failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to retrieve roles due to an internal error' });
        }
    }

    static async getRoleById(req, res) {
        console.log('get role by id', req.params);
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
        console.log('update role', req.params && req.body);
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
        console.log('delete role', req.params);
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
        console.log('assign roles to user', req.params, req.body);
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
        console.log('revoke roles from user', req.params, req.body);
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
        console.log('get roles by user', req.params);
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

    static async resetMainRoles(req, res) {
        console.log('reset main roles', true);
        try {
            const result = await RoleService.resetMainRolesToDefault();
            res.status(200).json({
                message: "Main roles reset to default successfully",
                details: result
            });
        } catch (error) {
            console.error(`${new Date().toISOString()} - Reset main roles failed:`, error);
            res.status(500).json({
                error: error.message || 'Failed to reset main roles due to an internal error'
            });
        }
    }
}





module.exports = RoleController;