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



    static async assignPermissionsToRole(req, res) {
        try {
            const { roleID } = req.params;
            const { permissionIDs } = req.body;
            if (!roleID || !Array.isArray(permissionIDs)) {
                return res.status(400).json({ error: 'Role ID and permission IDs array are required' });
            }
            const result = await PermissionService.assignPermissionsToRole(roleID, permissionIDs);
            res.status(200).json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Assign permissions to role failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to assign permissions to role due to an internal error' });
        }
    }

    static async revokePermissionsFromRole(req, res) {
        try {
            const { roleID } = req.params;
            const { permissionIDs } = req.body;
            if (!roleID || !Array.isArray(permissionIDs)) {
                return res.status(400).json({ error: 'Role ID and permission IDs array are required' });
            }
            const result = await PermissionService.revokePermissionsFromRole(roleID, permissionIDs);
            res.status(200).json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Revoke permissions from role failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to revoke permissions from role due to an internal error' });
        }
    }

    static async getPermissionsByRole(req, res) {
        try {
            const { roleID } = req.params;
            if (!roleID) {
                return res.status(400).json({ error: 'Role ID is required' });
            }
            const permissions = await PermissionService.getPermissionsByRole(roleID);
            res.status(200).json(permissions);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get permissions by role failed:`, error);
            res.status(404).json({ error: error.message || 'Role not found' });
        }
    }

    

    static async addPermissionOverride(req, res) {
        try {
            const { userID } = req.params;
            const { roleID, permissionID, action } = req.body;
            if (!userID || !roleID || !permissionID || !['grant', 'revoke'].includes(action)) {
                return res.status(400).json({ error: 'User ID, role ID, permission ID, and valid action (grant/revoke) are required' });
            }
            const override = await PermissionService.addPermissionOverride(userID, roleID, permissionID, action);
            res.status(201).json(override);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Add permission override failed:`, error);
            res.status(400).json({ error: error.message });
        }
    }

    static async removePermissionOverride(req, res) {
        try {
            const { overrideID } = req.params;
            if (!overrideID) {
                return res.status(400).json({ error: 'Override ID is required' });
            }
            const result = await PermissionService.removePermissionOverride(overrideID);
            res.status(200).json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Remove permission override failed:`, error);
            res.status(400).json({ error: error.message });
        }
    }

    static async getEffectivePermissions(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                return res.status(400).json({ error: 'User ID is required'});
            }
            const permissions = await PermissionService.getEffectivePermissions(userID);
            res.status(200).json(permissions);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get effective permissions failed:`, error);
            res.status(404).json({ error: error.message });
        }
    }

    static async getPermissionOverrides(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const overrides = await PermissionService.getPermissionOverrides(userID);
            res.status(200).json(overrides);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get permission overrides failed:`, error);
            res.status(404).json({ error: error.message });
        }
    }

}

module.exports = PermissionController;