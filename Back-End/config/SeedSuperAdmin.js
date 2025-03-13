const bcrypt = require('bcrypt');
const { sequelize, User, Role, Permission } = require('../models');
require('dotenv').config();

// Configuration for the Super Admin
const SUPER_ADMIN_CONFIG = {
    email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@example.com',
    password: process.env.SUPER_ADMIN_PASSWORD || 'SuperSecurePassword123!',
    firstname: 'Super', // Changed to lowercase 'firstname'
    lastname: 'Admin',  // Changed to lowercase 'lastname'
    phone: '000-000-0000', // Default value for required field
    wallet: '0x000',         // Default value for required field (assuming it's a number)
    roleName: 'Super Admin',
};

async function seedSuperAdmin() {
    try {
        console.log(`${new Date().toISOString()} - Starting Super Admin seeding process...`);

        console.log(`${new Date().toISOString()} - Syncing database schema...`);
        await sequelize.sync({ alter: true });
        console.log(`${new Date().toISOString()} - Database schema synced`);

        // Step 1: Create or find the Super Admin role
        console.log(`${new Date().toISOString()} - Checking for 'Super Admin' role...`);
        const [superAdminRole, roleCreated] = await Role.findOrCreate({
            where: { name: SUPER_ADMIN_CONFIG.roleName },
            defaults: {
                roleID: `role_${Math.random().toString(36).substr(2, 9)}`, // Replace with nanoid if preferred
                name: SUPER_ADMIN_CONFIG.roleName,
                description: 'Role with full administrative privileges',
            },
        });
        console.log(`${new Date().toISOString()} - 'Super Admin' role ${roleCreated ? 'created' : 'already exists'} with ID: ${superAdminRole.roleID}`);

        // Step 2: Fetch all permissions
        console.log(`${new Date().toISOString()} - Fetching all permissions from database...`);
        const allPermissions = await Permission.findAll();
        console.log(`${new Date().toISOString()} - Found ${allPermissions.length} permissions`);

        if (allPermissions.length === 0) {
            console.warn(`${new Date().toISOString()} - No permissions found in the database. Run seedPermissions.js first.`);
            return;
        }

        // Step 3: Assign all permissions to the Super Admin role
        console.log(`${new Date().toISOString()} - Assigning permissions to 'Super Admin' role...`);
        let newAssignments = 0;
        const currentPermissions = await superAdminRole.getPermissions();
        const currentPermissionIDs = currentPermissions.map(p => p.permissionID);

        for (const permission of allPermissions) {
            if (!currentPermissionIDs.includes(permission.permissionID)) {
                await superAdminRole.addPermission(permission);
                console.log(`${new Date().toISOString()} - Assigned new permission ${permission.name} to 'Super Admin' role`);
                newAssignments++;
            }
        }
        console.log(`${new Date().toISOString()} - Permissions assigned to 'Super Admin' role (${newAssignments} new assignments)`);

        // Step 4: Create or find the Super Admin user
        console.log(`${new Date().toISOString()} - Checking for Super Admin user with email: ${SUPER_ADMIN_CONFIG.email}...`);
        const hashedPassword = await bcrypt.hash(SUPER_ADMIN_CONFIG.password, 10);
        const [superAdminUser, userCreated] = await User.findOrCreate({
            where: { email: SUPER_ADMIN_CONFIG.email },
            defaults: {
                userID: `user_${Math.random().toString(36).substr(2, 9)}`, // Replace with nanoid if preferred
                email: SUPER_ADMIN_CONFIG.email,
                password: hashedPassword,
                firstname: SUPER_ADMIN_CONFIG.firstname, // Correct field name
                lastname: SUPER_ADMIN_CONFIG.lastname,   // Correct field name
                phone: SUPER_ADMIN_CONFIG.phone,         // Required field
                wallet: SUPER_ADMIN_CONFIG.wallet,       // Required field
            },
        });
        console.log(`${new Date().toISOString()} - Super Admin user ${userCreated ? 'created' : 'already exists'} with ID: ${superAdminUser.userID}`);

        // Step 5: Assign the Super Admin role to the user
        console.log(`${new Date().toISOString()} - Linking Super Admin user to 'Super Admin' role...`);
        const currentRoles = await superAdminUser.getRoles();
        const currentRoleIDs = currentRoles.map(r => r.roleID);
        let userRoleCreated = false;

        if (!currentRoleIDs.includes(superAdminRole.roleID)) {
            await superAdminUser.addRole(superAdminRole);
            userRoleCreated = true;
        }
        console.log(`${new Date().toISOString()} - 'Super Admin' role ${userRoleCreated ? 'assigned' : 'already assigned'} to user ${superAdminUser.email}`);

        console.log(`${new Date().toISOString()} - Super Admin seeding completed successfully`);
        console.log(`${new Date().toISOString()} - Super Admin Credentials:`);
        console.log(`  Email: ${SUPER_ADMIN_CONFIG.email}`);
        console.log(`  Password: ${SUPER_ADMIN_CONFIG.password}`);
    } catch (error) {
        console.error(`${new Date().toISOString()} - Error seeding Super Admin:`, error);
        throw error;
    }
}

module.exports = { seedSuperAdmin };

if (require.main === module) {
    seedSuperAdmin();
}