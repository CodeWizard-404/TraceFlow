// controllers/permissionController.js
const PermissionService = require('../services/permissionService');

class PermissionController {
    static async getAllPermissions(req, res) {
        try {
            const permissions = await PermissionService.getAllPermissions();
            res.status(200).json(permissions);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get all permissions failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to retrieve permissions due to an internal error' });
        }
    }

    static async getPermissionById(req, res) {
        try {
            const { permissionID } = req.params;
            if (!permissionID) {
                return res.status(400).json({ error: 'Permission ID is required' });
            }
            const permission = await PermissionService.getPermissionById(permissionID);
            res.status(200).json(permission);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get permission by ID failed:`, error);
            res.status(404).json({ error: error.message || 'Permission not found' });
        }
    }

    static async createPermission(req, res) {
        try {
            const { name, type, className, description } = req.body;
            if (!name || !type || !className) {
                return res.status(400).json({ error: 'Name, type, and className are required' });
            }
            const permission = await PermissionService.createPermission(name, type, className, description);
            res.status(201).json(permission);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Create permission failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to create permission due to an internal error' });
        }
    }

    static async updatePermission(req, res) {
        try {
            const { permissionID } = req.params;
            const { name, type, className, description } = req.body;
            if (!permissionID) {
                return res.status(400).json({ error: 'Permission ID is required' });
            }
            const permission = await PermissionService.updatePermission(permissionID, { name, type, className, description });
            res.status(200).json(permission);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Update permission failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to update permission due to an internal error' });
        }
    }

    static async deletePermission(req, res) {
        try {
            const { permissionID } = req.params;
            if (!permissionID) {
                return res.status(400).json({ error: 'Permission ID is required' });
            }
            await PermissionService.deletePermission(permissionID);
            res.status(200).json({ message: 'Permission deleted successfully' });
        } catch (error) {
            console.error(`${new Date().toISOString()} - Delete permission failed:`, error);
            res.status(404).json({ error: error.message || 'Permission not found' });
        }
    }
}

module.exports = PermissionController;