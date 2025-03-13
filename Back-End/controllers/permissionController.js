const PermissionService = require('../services/permissionService');

class PermissionController {
    async getAllPermissions(req, res) {
        try {
            const permissions = await PermissionService.getAllPermissions();
            res.status(200).json(permissions);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getPermissionById(req, res) {
        try {
            const { permissionID } = req.params;
            const permission = await PermissionService.getPermissionById(permissionID);
            res.status(200).json(permission);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    async createPermission(req, res) {
        try {
            const { name, type, className, description } = req.body;
            const permission = await PermissionService.createPermission(name, type, className, description);
            res.status(201).json(permission);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async updatePermission(req, res) {
        try {
            const { permissionID } = req.params;
            const { name, type, className, description } = req.body;
            const permission = await PermissionService.updatePermission(permissionID, name, type, className, description);
            res.status(200).json(permission);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async deletePermission(req, res) {
        try {
            const { permissionID } = req.params;
            const permission = await PermissionService.deletePermission(permissionID);
            res.status(200).json(permission);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

}

module.exports = new PermissionController();