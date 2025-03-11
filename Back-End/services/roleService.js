const { Role, User, Permission } = require('../models');

const roleService = {
    // addRole(roleDetails): Create a new role with specific permissions (US 49)
    async addRole(adminID, roleDetails) {
        const { name, description, permissionIDs = [] } = roleDetails;

        // Validate admin
        const admin = await User.findByPk(adminID);
        if (!admin) throw new Error('Admin not found');

        // Check if role name is unique
        const existingRole = await Role.findOne({ where: { name } });
        if (existingRole) throw new Error('Role name already exists');

        const role = await Role.create({ name, description });

        // Assign permissions if provided
        if (permissionIDs.length > 0) {
            await role.setPermissions(permissionIDs); // Link permissions to role
        }

        return role;
    },

    // viewRole(roleID): View a role’s details, including assigned permissions (US 52)
    async viewRole(adminID, roleID) {
        const admin = await User.findByPk(adminID);
        if (!admin) throw new Error('Admin not found');

        const role = await Role.findByPk(roleID, {
            include: [{ model: Permission, attributes: ['permissionID', 'permission', 'description'] }],
        });
        if (!role) throw new Error('Role not found');

        return role;
    },

    // listRoles(): List all roles with their permissions
    async listRoles(adminID) {
        const admin = await User.findByPk(adminID);
        if (!admin) throw new Error('Admin not found');

        const roles = await Role.findAll({
            include: [{ model: Permission, attributes: ['permissionID', 'permission', 'description'] }],
        });
        return roles;
    },

    // assign(userID, roleID): Assign a role (and its permissions) to a user (US 53)
    async assign(adminID, userID, roleID) {
        const admin = await User.findByPk(adminID);
        if (!admin) throw new Error('Admin not found');

        const user = await User.findByPk(userID);
        if (!user) throw new Error('User not found');

        const role = await Role.findByPk(roleID);
        if (!role) throw new Error('Role not found');

        await user.addRole(role); // Assign single role to user
        return user;
    },
};

module.exports = roleService;