const { Permission, Role } = require('../models');

class PermissionService {
    // Create a new permission
    static async createPermission(permission, description) {
        const perm = await Permission.create({ permission, description });
        return perm;
    }

    // Get all permissions
    static async getAllPermissions() {
        return await Permission.findAll();
    }

    // Get a permission by ID
    static async getPermissionById(permissionID) {
        const perm = await Permission.findByPk(permissionID);
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

    // Assign permission to role (many-to-many)
    static async assignPermissionToRole(roleID, permissionID) {
        const role = await Role.findByPk(roleID);
        const perm = await Permission.findByPk(permissionID);
        if (!role || !perm) throw new Error('Role or Permission not found');
        await role.addPermission(perm); // Sequelize method for many-to-many
    }
}

module.exports = PermissionService;