const bcrypt = require('bcrypt');
const axios = require('axios');
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

async function getAdminToken() {
    const response = await axios.post(
        `${process.env.KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
        new URLSearchParams({
            grant_type: 'password',
            client_id: 'admin-cli',
            username: process.env.KEYCLOAK_ADMIN_USER || 'admin',
            password: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
        })
    );
    return response.data.access_token;
}

async function createOrUpdateKeycloakUser(token, email, password, firstname, lastname, phone, wallet) {
    const userCheck = await axios.get(
        `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users?email=${email}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );

    let keycloakId;
    if (userCheck.data.length > 0) {
        keycloakId = userCheck.data[0].id;
        console.log(`Super Admin ${email} already exists in Keycloak, updating password...`);
        await axios.put(
            `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users/${keycloakId}/reset-password`,
            { type: 'password', value: password, temporary: false },
            { headers: { Authorization: `Bearer ${token}` } }
        );
    } else {
        await axios.post(
            `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users`,
            {
                username: email,
                email: email,
                firstName: firstname,
                lastName: lastname,
                enabled: true,
                attributes: { phone: phone, wallet: wallet },
                credentials: [{ type: 'password', value: password, temporary: false }],
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const createdUser = await axios.get(
            `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users?email=${email}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        keycloakId = createdUser.data[0].id;
        console.log(`Created Super Admin ${email} in Keycloak`);
    }
    return keycloakId;
}

async function seedSuperAdmin() {
    try {
        await sequelize.sync({ alter: true });

        // Get Keycloak admin token
        const token = await getAdminToken();

        // Create or update Super Admin in Keycloak
        const keycloakId = await createOrUpdateKeycloakUser(
            token,
            SUPER_ADMIN_CONFIG.email,
            SUPER_ADMIN_CONFIG.password,
            SUPER_ADMIN_CONFIG.firstname,
            SUPER_ADMIN_CONFIG.lastname,
            SUPER_ADMIN_CONFIG.phone,
            SUPER_ADMIN_CONFIG.wallet
        );

        // Create or find Super Admin role in local DB
        const [superAdminRole, roleCreated] = await Role.findOrCreate({
            where: { name: SUPER_ADMIN_CONFIG.roleName },
            defaults: {
                roleID: `role_${Math.random().toString(36).substr(2, 9)}`,
                name: SUPER_ADMIN_CONFIG.roleName,
                description: 'Role with full administrative privileges',
            },
        });

        // Assign all permissions to Super Admin role in local DB
        const allPermissions = await Permission.findAll();
        if (allPermissions.length === 0) {
            console.log('No permissions found to assign to Super Admin role');
            return;
        }
        const currentPermissions = await superAdminRole.getPermissions();
        const currentPermissionIDs = currentPermissions.map(p => p.permissionID);
        for (const permission of allPermissions) {
            if (!currentPermissionIDs.includes(permission.permissionID)) {
                await superAdminRole.addPermission(permission);
            }
        }

        // Create or find Super Admin user in local DB
        const [superAdminUser, userCreated] = await User.findOrCreate({
            where: { email: SUPER_ADMIN_CONFIG.email },
            defaults: {
                userID: `user_${Math.random().toString(36).substr(2, 9)}`,
                email: SUPER_ADMIN_CONFIG.email,
                password: 'keycloak_managed',
                firstname: SUPER_ADMIN_CONFIG.firstname,
                lastname: SUPER_ADMIN_CONFIG.lastname,
                phone: SUPER_ADMIN_CONFIG.phone,
                wallet: SUPER_ADMIN_CONFIG.wallet,
                keycloakId: keycloakId,
            },
        });

        // Update keycloakId if user already existed
        if (!userCreated && !superAdminUser.keycloakId) {
            await superAdminUser.update({ keycloakId });
        }

        // Assign role to user in local DB
        const currentRoles = await superAdminUser.getRoles();
        const currentRoleIDs = currentRoles.map(r => r.roleID);
        if (!currentRoleIDs.includes(superAdminRole.roleID)) {
            await superAdminUser.addRole(superAdminRole);
        }

        // Ensure "Super Admin" role exists in Keycloak
        let roleId;
        try {
            const roleCheck = await axios.get(
                `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/roles/${SUPER_ADMIN_CONFIG.roleName}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            roleId = roleCheck.data.id;
            console.log(`Role ${SUPER_ADMIN_CONFIG.roleName} already exists in Keycloak`);
        } catch (error) {
            if (error.response?.status === 404) {
                await axios.post(
                    `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/roles`,
                    {
                        name: SUPER_ADMIN_CONFIG.roleName,
                        description: 'Role with full administrative privileges',
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const newRole = await axios.get(
                    `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/roles/${SUPER_ADMIN_CONFIG.roleName}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                roleId = newRole.data.id;
                console.log(`Created role ${SUPER_ADMIN_CONFIG.roleName} in Keycloak`);
            } else {
                throw error;
            }
        }

        // Assign the role to the user in Keycloak
        const roleMappingCheck = await axios.get(
            `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users/${keycloakId}/role-mappings/realm`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const hasRole = roleMappingCheck.data.some(role => role.name === SUPER_ADMIN_CONFIG.roleName);
        if (!hasRole) {
            await axios.post(
                `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users/${keycloakId}/role-mappings/realm`,
                [{ id: roleId, name: SUPER_ADMIN_CONFIG.roleName }],
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log(`Assigned ${SUPER_ADMIN_CONFIG.roleName} to ${SUPER_ADMIN_CONFIG.email} in Keycloak`);
        } else {
            console.log(`Role ${SUPER_ADMIN_CONFIG.roleName} already assigned to ${SUPER_ADMIN_CONFIG.email} in Keycloak`);
        }

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