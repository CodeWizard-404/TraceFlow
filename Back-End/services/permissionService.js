const { Permission, Role, User } = require('../models');

const permissionService = {
    // createPermission(permissionDetails): Create a new permission representing an app functionality
    async createPermission(adminID, permissionDetails) {
        const { permission, description } = permissionDetails; // e.g., permission: "create_timesheet"

        // Validate admin (assuming adminID has full access)
        const admin = await User.findByPk(adminID);
        if (!admin) throw new Error('Admin not found');

        // Check if permission already exists
        const existingPermission = await Permission.findOne({ where: { permission } });
        if (existingPermission) throw new Error('Permission already exists');

        const newPermission = await Permission.create({
            permission, // Unique identifier for the functionality (e.g., "view_reports")
            description, // Human-readable explanation (e.g., "Allows viewing dynamic reports")
        });

        return newPermission;
    },

    // listPermissions(): List all permissions (app functionalities) available
    async listPermissions(adminID) {
        const admin = await User.findByPk(adminID);
        if (!admin) throw new Error('Admin not found');

        const permissions = await Permission.findAll({
            include: [{ model: Role, through: { attributes: [] }, attributes: ['roleID', 'name'] }],
        });
        return permissions;
    },

    // Helper method: Assign permissions to a role (used internally or by roleService)
    async assignPermissionsToRole(adminID, roleID, permissionIDs) {
        const admin = await User.findByPk(adminID);
        if (!admin) throw new Error('Admin not found');

        const role = await Role.findByPk(roleID);
        if (!role) throw new Error('Role not found');

        await role.setPermissions(permissionIDs);
        return role;
    },
};

module.exports = permissionService;