const { Role } = require('../models');

class RoleService {
    // Create a new role
    static async createRole(name, description) {
        const role = await Role.create({ name, description });
        return role;
    }

    // Get all roles
    static async getAllRoles() {
        return await Role.findAll();
    }

    // Get a role by ID
    static async getRoleById(roleID) {
        const role = await Role.findByPk(roleID);
        if (!role) throw new Error('Role not found');
        return role;
    }

    // Update a role
    static async updateRole(roleID, updates) {
        const role = await Role.findByPk(roleID);
        if (!role) throw new Error('Role not found');
        await role.update(updates);
        return role;
    }

    // Delete a role
    static async deleteRole(roleID) {
        const role = await Role.findByPk(roleID);
        if (!role) throw new Error('Role not found');
        await role.destroy();
    }
}

module.exports = RoleService;