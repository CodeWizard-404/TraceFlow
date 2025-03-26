const bcrypt = require('bcrypt');
const { sequelize, User, Role, Permission } = require('../models');
require('dotenv').config();

const SUPER_ADMIN_CONFIG = {
    email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@example.com',
    password: process.env.SUPER_ADMIN_PASSWORD || 'SuperSecurePassword123!',
    firstname: 'Super',
    lastname: 'Admin',
    phone: '000-000-0000',
    wallet: '0x000',
    roleName: 'Super Admin',
};

async function seedSuperAdmin() {
    try {
        await sequelize.sync({ alter: true });

        // Create or find Super Admin role
        const [superAdminRole, roleCreated] = await Role.findOrCreate({
            where: { name: SUPER_ADMIN_CONFIG.roleName },
            defaults: {
                roleID: `role_${Math.random().toString(36).substr(2, 9)}`,
                name: SUPER_ADMIN_CONFIG.roleName,
                description: 'Role with full administrative privileges',
            },
        });

        // Assign all permissions to Super Admin role
        const allPermissions = await Permission.findAll();
        if (allPermissions.length === 0) return;
        const currentPermissions = await superAdminRole.getPermissions();
        const currentPermissionIDs = currentPermissions.map(p => p.permissionID);
        for (const permission of allPermissions) {
            if (!currentPermissionIDs.includes(permission.permissionID)) {
                await superAdminRole.addPermission(permission);
            }
        }

        // Create or find Super Admin user
        const hashedPassword = await bcrypt.hash(SUPER_ADMIN_CONFIG.password, 10);
        const [superAdminUser, userCreated] = await User.findOrCreate({
            where: { email: SUPER_ADMIN_CONFIG.email },
            defaults: {
                userID: `user_${Math.random().toString(36).substr(2, 9)}`,
                email: SUPER_ADMIN_CONFIG.email,
                password: hashedPassword,
                firstname: SUPER_ADMIN_CONFIG.firstname,
                lastname: SUPER_ADMIN_CONFIG.lastname,
                phone: SUPER_ADMIN_CONFIG.phone,
                wallet: SUPER_ADMIN_CONFIG.wallet,
            },
        });

        // Assign role to user
        const currentRoles = await superAdminUser.getRoles();
        const currentRoleIDs = currentRoles.map(r => r.roleID);
        if (!currentRoleIDs.includes(superAdminRole.roleID)) {
            await superAdminUser.addRole(superAdminRole);
        }

        // Output credentials
        console.log(`\x1b[34m\nSuper Admin Credentials:\n\tEmail:\t\t${SUPER_ADMIN_CONFIG.email}\n\tPassword:\t${SUPER_ADMIN_CONFIG.password}\n\x1b[0m`);
        } catch (error) {
        console.error('Error seeding Super Admin:', error);
        throw error;
    }
}

module.exports = { seedSuperAdmin };

if (require.main === module) {
    seedSuperAdmin();
}