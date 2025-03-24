const { Role, Permission, User } = require('../models');

class RoleService {
    // Create a new role
    static async createRole(name, description) {
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
    static async getAllRoles() {
        try {
            return await Role.findAll({
                attributes: ['roleID', 'name', 'description'],
            });
        } catch (error) {
            throw new Error(`Failed to fetch roles: ${error.message}`);
        }
    }

    // Get role by ID
    static async getRoleById(roleID) {
        try {
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error('Role not found');
            return role;
        } catch (error) {
            throw new Error(`Failed to fetch role: ${error.message}`);
        }
    }

    // Delete a role
    static async deleteRole(roleID) {
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
    static async updateRole(roleID, updates) {
        try {
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error('Role not found');
            await role.update(updates);
            return role;
        } catch (error) {
            throw new Error(`Failed to update role: ${error.message}`);
        }
    }


    // Assign roles to a user
    static async assignRolesToUser(userID, roleIDs) {
        try {
            const user = await User.findByPk(userID);
            if (!user) throw new Error('User not found');

            const roles = await Role.findAll({
                where: { roleID: roleIDs },
            });
            if (roles.length !== roleIDs.length) {
                throw new Error('One or more roles not found');
            }

            const currentRoles = await user.getRoles();
            const currentRoleIDs = currentRoles.map(r => r.roleID);
            const newRoles = roles.filter(r => !currentRoleIDs.includes(r.roleID));

            if (newRoles.length > 0) {
                await user.addRoles(newRoles);
            }

            return {
                userID,
                assignedRoles: newRoles.map(r => r.name),
                totalAssigned: (await user.getRoles()).length,
            };
        } catch (error) {
            throw new Error(`Failed to assign roles: ${error.message}`);
        }
    }

    // Rovoke role to user
    static async revokeRoleFromUser(userID, roleIDs) {
        try {
            const user = await User.findByPk(userID);
            if (!user) throw new Error('User not found');

            // Validate and process each roleID
            const results = [];
            for (const roleID of roleIDs) {
                const role = await Role.findByPk(roleID);
                if (!role) throw new Error(`Role not found: ${roleID}`);

                const hasRole = await user.hasRole(role);
                if (!hasRole) throw new Error(`User does not have role: ${roleID}`);

                await user.removeRole(role);
                results.push({
                    userID,
                    revokedRole: role,
                    totalAssigned: (await user.getRoles()).length,
                    message: `Role ${roleID} revoked successfully`
                });
            }

            return results.length === 1 ? results[0] : results; // Return single object if one role, array if multiple
        } catch (error) {
            throw new Error(`Failed to revoke role(s): ${error.message}`);
        }
    }
    // Get roles by user
    static async getRolesByUser(userID) {
        try {
            const user = await User.findByPk(userID, {
                include: [{
                    model: Role,
                    through: { attributes: [] },
                    attributes: ['roleID', 'name', 'description'],
                    include: [{
                        model: Permission,
                        through: { attributes: [] },
                        attributes: ['name', 'description'],
                    }],
                }],
            });
            if (!user) throw new Error('User not found');
            return user.Roles;
        } catch (error) {
            throw new Error(`Failed to fetch roles for user: ${error.message}`);
        }
    }



}

module.exports = RoleService;