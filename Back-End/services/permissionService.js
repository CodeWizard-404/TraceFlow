const { Permission, Role, User, UserPermissionOverride } = require('../models');

class PermissionService {
    // Create a new permission
    static async createPermission(name, type, className, description) {
        const perm = await Permission.create({ name, type, className, description });
        return perm;
    }

    // Get all permissions
    static async getAllPermissions() {
        return await Permission.findAll();
    }

    // Get a permission by ID
    static async getPermissionById(permissionID) {
        const perm = await Permission.findByPk(permissionID, {
            include: [{
                model: Role,
                attributes: ['roleID', 'name']
            }]
        });
        if (!perm) throw new Error('Permission not found');
        return perm;
    }

    // Update a permission
    static async updatePermission(permissionID, updates) {
        const perm = await Permission.findByPk(permissionID);
        if (!perm) throw new Error('Permission not found');
        await perm.update(updates);
        return perm;
    }

    // Delete a permission
    static async deletePermission(permissionID) {
        const perm = await Permission.findByPk(permissionID);
        if (!perm) throw new Error('Permission not found');
        await perm.destroy();
    }




    // Assign permissions to a role
    static async assignPermissionsToRole(roleID, permissionIDs) {
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

    // Revoke permissions from a role
    static async revokePermissionsFromRole(roleID, permissionIDs) {
        try {
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error('Role not found');

            // Validate and process each permissionID
            const results = [];
            for (const permissionID of permissionIDs) {
                const permission = await Permission.findByPk(permissionID);
                if (!permission) throw new Error(`Permission not found: ${permissionID}`);

                const hasPermission = await role.hasPermission(permission);
                if (!hasPermission) throw new Error(`Role does not have permission: ${permissionID}`);

                await role.removePermission(permission);
                results.push({
                    roleID,
                    revokedPermission: permission,
                    totalAssigned: (await role.getPermissions()).length,
                    message: `Permission ${permissionID} revoked successfully`
                });
            }

            return results.length === 1 ? results[0] : results; // Return single object if one permission, array if multiple
        } catch (error) {
            throw new Error(`Failed to revoke permission(s): ${error.message}`);
        }
    }

    // Get permissions by role
    static async getPermissionsByRole(roleID) {
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




    // Add a permission override for a user within a role
    static async addPermissionOverride(userID, roleID, permissionID, action) {
        try {
            const user = await User.findByPk(userID);
            if (!user) throw new Error('User not found');

            const role = await Role.findByPk(roleID);
            if (!role) throw new Error('Role not found');

            const permission = await Permission.findByPk(permissionID);
            if (!permission) throw new Error('Permission not found');

            // Check if the user has the role
            const userRoles = await user.getRoles({ where: { roleID } });
            if (!userRoles.length) throw new Error('User does not have this role');

            // Check if the override already exists
            const [override, created] = await UserPermissionOverride.findOrCreate({
                where: { userID, roleID, permissionID },
                defaults: { action },
            });

            if (!created) {
                await override.update({ action });
            }

            return override;
        } catch (error) {
            throw new Error(`Failed to add permission override: ${error.message}`);
        }
    }

    // Remove a permission override
    static async removePermissionOverride(overrideID) {
        try {
            const override = await UserPermissionOverride.findByPk(overrideID);
            if (!override) throw new Error('Override not found');
            await override.destroy();
            return { message: 'Override removed successfully' };
        } catch (error) {
            throw new Error(`Failed to remove permission override: ${error.message}`);
        }
    }

    // Get effective permissions for a user
    static async getEffectivePermissions(userID) {
        try {
            const user = await User.findByPk(userID, {
                include: [{
                    model: Role,
                    through: { attributes: [] },
                    include: [{
                        model: Permission,
                        through: { attributes: [] },
                        attributes: ['permissionID', 'name', 'type', 'class', 'description'],
                    }],
                }, {
                    model: UserPermissionOverride,
                    include: [{ model: Permission }],
                }],
            });
            if (!user) throw new Error('User not found');

            // Aggregate role-based permissions
            const rolePermissions = {};
            for (const role of user.Roles) {
                rolePermissions[role.roleID] = role.Permissions.reduce((acc, perm) => {
                    acc[perm.permissionID] = perm;
                    return acc;
                }, {});
            }

            // Apply overrides
            for (const override of user.UserPermissionOverrides) {
                const { roleID, permissionID, action } = override;
                if (!rolePermissions[roleID]) continue;

                if (action === 'revoke') {
                    delete rolePermissions[roleID][permissionID];
                } else if (action === 'grant') {
                    rolePermissions[roleID][permissionID] = override.Permission;
                }
            }

            // Flatten the permissions into a single array
            const effectivePermissions = [];
            for (const roleID in rolePermissions) {
                effectivePermissions.push(...Object.values(rolePermissions[roleID]));
            }

            return effectivePermissions;
        } catch (error) {
            throw new Error(`Failed to fetch effective permissions: ${error.message}`);
        }
    }

    // Get permission overrides for a user
    static async getPermissionOverrides(userID) {
        try {
            const user = await User.findByPk(userID, {
                include: [{
                    model: UserPermissionOverride,
                    include: [{ model: Permission }],
                }],
            });
            if (!user) throw new Error('User not found');
            return user.UserPermissionOverrides;
        } catch (error) {
            throw new Error(`Failed to fetch permission overrides: ${error.message}`);
        }
    }


}

module.exports = PermissionService;