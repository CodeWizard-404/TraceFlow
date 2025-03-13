const RoleService = require('../services/roleService');

class RoleController {
    async createRole(req, res) {
        try {
            const { name, description } = req.body;
            const role = await RoleService.createRole(name, description);
            res.status(201).json(role);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getAllRoles(req, res) {
        try {
            const roles = await RoleService.getAllRoles();
            res.status(200).json(roles);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getRoleById(req, res) {
        try {
            const { roleID } = req.params;
            const role = await RoleService.getRoleById(roleID);
            res.status(200).json(role);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    async updateRole(req, res) {
        try {
            const { roleID } = req.params;
            const { name, description } = req.body;
            const role = await RoleService.updateRole(roleID, name, description);
            res.status(200).json(role);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async deleteRole(req, res) {
        try {
            const { roleID } = req.params;
            const role = await RoleService.deleteRole(roleID);
            res.status(200).json(role);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    async assignPermissionsToRole(req, res) {
        try {
            const { roleID } = req.params;
            const { permissionIDs } = req.body; // Array of permission IDs
            const result = await RoleService.assignPermissionsToRole(roleID, permissionIDs);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getPermissionsByRole(req, res) {
        try {
            const { roleID } = req.params;
            const permissions = await RoleService.getPermissionsByRole(roleID);
            res.status(200).json(permissions);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }
}

module.exports = new RoleController();