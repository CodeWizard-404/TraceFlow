const PermissionService = require("../services/permissionService");

class PermissionController {
    // Get all permissions
    static async getAllPermissions(req, res) {
        console.log("getAllPermissions", true);
        try {
            const permissions = await PermissionService.getAllPermissions();
            res.status(200).json(permissions);
        } catch (error) {
            res.status(500).json({ error: error.message || "Could not fetch permissions." });
        }
    }

    // Get permission by ID
    static async getPermissionById(req, res) {
        console.log("getPermissionById", req.params);
        try {
            const { permissionID } = req.params;
            if (!permissionID) {
                return res.status(400).json({ error: "Permission ID is required." });
            }
            const permission = await PermissionService.getPermissionById(permissionID);
            res.status(200).json(permission);
        } catch (error) {
            res.status(404).json({ error: error.message || "Permission not found." });
        }
    }

    // Update permission
    static async updatePermission(req, res) {
        console.log("updatePermission", req.body, req.params);
        try {
            const { permissionID } = req.params;
            const { className, description } = req.body;
            if (!permissionID) {
                return res.status(400).json({ error: "Permission ID is required." });
            }
            const permission = await PermissionService.updatePermission(permissionID, {
                className,
                description,
            });
            res.status(200).json(permission);
        } catch (error) {
            res.status(400).json({ error: error.message || "Could not update permission." });
        }
    }

    // Assign permissions to a role
    static async assignPermissionsToRole(req, res) {
        console.log("assignPermissionsToRole", req.body, req.params);
        try {
            const { roleID } = req.params;
            const { permissionIDs } = req.body;
            if (!roleID || !Array.isArray(permissionIDs)) {
                return res.status(400).json({ error: "Role ID and permission IDs are required." });
            }
            const result = await PermissionService.assignPermissionsToRole(
                req.user,
                roleID,
                permissionIDs
            );
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({
                error: error.message || "Could not assign permissions to role.",
            });
        }
    }

    // Revoke permissions from a role
    static async revokePermissionsFromRole(req, res) {
        console.log("revokePermissionsFromRole", req.body, req.params);
        try {
            const { roleID } = req.params;
            const { permissionIDs } = req.body;
            if (!roleID || !Array.isArray(permissionIDs)) {
                return res.status(400).json({ error: "Role ID and permission IDs are required." });
            }
            const result = await PermissionService.revokePermissionsFromRole(
                roleID,
                permissionIDs
            );
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({
                error: error.message || "Could not revoke permissions from role.",
            });
        }
    }

    // Get permissions by role
    static async getPermissionsByRole(req, res) {
        console.log("getPermissionsByRole", req.params);
        try {
            const { roleID } = req.params;
            if (!roleID) {
                return res.status(400).json({ error: "Role ID is required." });
            }
            const permissions = await PermissionService.getPermissionsByRole(roleID);
            res.status(200).json(permissions);
        } catch (error) {
            res.status(404).json({ error: error.message || "Role not found." });
        }
    }

    // Add permission override
    static async addPermissionOverride(req, res) {
        console.log("addPermissionOverride", req.body, req.params);
        try {
            const { userID } = req.params;
            const { roleID, permissionID, action } = req.body;
            if (!userID || !roleID || !permissionID || !["grant", "revoke"].includes(action)) {
                return res.status(400).json({
                    error: "User ID, role ID, permission ID, and action are required.",
                });
            }
            const override = await PermissionService.addPermissionOverride(
                req.user,
                userID,
                roleID,
                permissionID,
                action
            );
            res.status(201).json(override);
        } catch (error) {
            res.status(400).json({
                error: error.message || "Could not add permission override.",
            });
        }
    }

    // Remove permission override
    static async removePermissionOverride(req, res) {
        console.log("removePermissionOverride", req.params);
        try {
            const { overrideID } = req.params;
            if (!overrideID) {
                return res.status(400).json({ error: "Override ID is required." });
            }
            const result = await PermissionService.removePermissionOverride(overrideID);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({
                error: error.message || "Could not remove permission override.",
            });
        }
    }

    // Get effective permissions
    static async getEffectivePermissions(req, res) {
        console.log("getEffectivePermissions", req.params);
        try {
            const { userID } = req.params;
            if (!userID) {
                return res.status(400).json({ error: "User ID is required." });
            }
            const permissions = await PermissionService.getEffectivePermissions(userID);
            res.status(200).json(permissions);
        } catch (error) {
            res.status(404).json({
                error: error.message || "Could not fetch effective permissions.",
            });
        }
    }

    // Get permission overrides
    static async getPermissionOverrides(req, res) {
        console.log("getPermissionOverrides", req.params);
        try {
            const { userID } = req.params;
            if (!userID) {
                return res.status(400).json({ error: "User ID is required." });
            }
            const overrides = await PermissionService.getPermissionOverrides(userID);
            res.status(200).json(overrides);
        } catch (error) {
            res.status(404).json({
                error: error.message || "Could not fetch permission overrides.",
            });
        }
    }
}

module.exports = PermissionController;