const RoleService = require("../services/roleService");

class RoleController {
    // Create a new role
    static async createRole(req, res) {
        try {
            const { name, description } = req.body;
            if (!name) {
                return res.status(400).json({ error: "Role name is required." });
            }
            const role = await RoleService.createRole(name, description);
            res.status(201).json(role);
        } catch (error) {
            res.status(400).json({ error: error.message || "Could not create role." });
        }
    }

    // Get all roles
    static async getAllRoles(req, res) {
        try {
            const roles = await RoleService.getAllRoles();
            res.status(200).json(roles);
        } catch (error) {
            res.status(500).json({ error: error.message || "Could not fetch roles." });
        }
    }

    // Get role by ID
    static async getRoleById(req, res) {
        try {
            const { roleID } = req.params;
            if (!roleID) {
                return res.status(400).json({ error: "Role ID is required." });
            }
            const role = await RoleService.getRoleById(roleID);
            res.status(200).json(role);
        } catch (error) {
            res.status(404).json({ error: error.message || "Role not found." });
        }
    }

    // Update a role
    static async updateRole(req, res) {
        try {
            const { roleID } = req.params;
            const { name, description } = req.body;
            if (!roleID) {
                return res.status(400).json({ error: "Role ID is required." });
            }
            const role = await RoleService.updateRole(roleID, { name, description });
            res.status(200).json(role);
        } catch (error) {
            res.status(400).json({ error: error.message || "Could not update role." });
        }
    }

    // Delete a role
    static async deleteRole(req, res) {
        try {
            const { roleID } = req.params;
            if (!roleID) {
                return res.status(400).json({ error: "Role ID is required." });
            }
            await RoleService.deleteRole(roleID);
            res.status(200).json({ message: "Role deleted successfully." });
        } catch (error) {
            res.status(400).json({ error: error.message || "Could not delete role." });
        }
    }

    // Assign roles to a user
    static async assignRolesToUser(req, res) {
        try {
            const { userID } = req.params;
            const { roleIDs } = req.body;
            if (!userID || !Array.isArray(roleIDs)) {
                return res.status(400).json({ error: "User ID and role IDs are required." });
            }
            const result = await RoleService.assignRolesToUser(userID, roleIDs);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message || "Could not assign roles." });
        }
    }

    // Revoke roles from a user
    static async revokeRolesFromUser(req, res) {
        try {
            const { userID } = req.params;
            const { roleIDs } = req.body;
            if (!userID || !Array.isArray(roleIDs) || roleIDs.length === 0) {
                return res.status(400).json({
                    error: "User ID and role IDs are required.",
                });
            }
            const result = await RoleService.revokeRolesFromUser(userID, roleIDs);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message || "Could not revoke roles." });
        }
    }

    // Get roles for a user
    static async getRolesByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                return res.status(400).json({ error: "User ID is required." });
            }
            const roles = await RoleService.getRolesByUser(userID);
            res.status(200).json(roles);
        } catch (error) {
            res.status(404).json({ error: error.message || "Could not fetch user roles." });
        }
    }

    // Reset main roles
    static async resetMainRoles(req, res) {
        try {
            const result = await RoleService.resetMainRolesToDefault();
            res.status(200).json({
                message: "Main roles reset successfully.",
                details: result,
            });
        } catch (error) {
            res.status(500).json({ error: error.message || "Could not reset roles." });
        }
    }
}

module.exports = RoleController;