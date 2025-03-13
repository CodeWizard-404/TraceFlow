const { Role, Permission } = require('../models');

class RoleService {
    // Create a new role
    async createRole(name, description) {
        try {
            const [role, created] = await Role.findOrCreate({
                where: { name },
                defaults: {
                    roleID: `role_${Math.random().toString(36).substr(2, 9)}`, // Replace with nanoid if preferred
                    name,
                    description,
                },
            });
            if (!created) throw new Error('Role already exists');
            return role;
        } catch (error) {
            throw new Error(`Failed to create role: ${error.message}`);
        }
    }

    // Get all roles
    async getAllRoles() {
        try {
            return await Role.findAll({
                attributes: ['roleID', 'name', 'description'],
            });
        } catch (error) {
            throw new Error(`Failed to fetch roles: ${error.message}`);
        }
    }

    // Get role by ID
    async getRoleById(roleID) {
        try {
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error('Role not found');
            return role;
        } catch (error) {
            throw new Error(`Failed to fetch role: ${error.message}`);
        }
    }

    // Delete a role
    async deleteRole(roleID) {
        try {
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error('Role not found');
            await role.destroy();
            return role;
        } catch (error) {
            throw new Error(`Failed to delete role: ${error.message}`);
        }
    }

    // Update a role    
    async updateRole(roleID, updates) {
        try {
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error('Role not found');
            await role.update(updates);
            return role;
        } catch (error) {
            throw new Error(`Failed to update role: ${error.message}`);
        }
    }

    // Assign permissions to a role
    async assignPermissionsToRole(roleID, permissionIDs) {
        try {
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error('Role not found');

            const permissions = await Permission.findAll({
                where: { permissionID: permissionIDs },
            });
            if (permissions.length !== permissionIDs.length) {
                throw new Error('One or more permissions not found');
            }

            const currentPermissions = await role.getPermissions();
            const currentPermissionIDs = currentPermissions.map(p => p.permissionID);
            const newPermissions = permissions.filter(p => !currentPermissionIDs.includes(p.permissionID));

            if (newPermissions.length > 0) {
                await role.addPermissions(newPermissions);
            }

            return {
                roleID,
                assignedPermissions: newPermissions.map(p => p.name),
                totalAssigned: (await role.getPermissions()).length,
            };
        } catch (error) {
            throw new Error(`Failed to assign permissions: ${error.message}`);
        }
    }

    // Get permissions by role
    async getPermissionsByRole(roleID) {
        try {
            const role = await Role.findByPk(roleID, {
                include: [{
                    model: Permission,
                    through: { attributes: [] }, // Exclude junction table attributes
                    attributes: ['permissionID', 'name', 'type', 'class', 'description'],
                }],
            });
            if (!role) throw new Error('Role not found');
            return role.Permissions;
        } catch (error) {
            throw new Error(`Failed to fetch permissions for role: ${error.message}`);
        }
    }
}

module.exports = new RoleService();