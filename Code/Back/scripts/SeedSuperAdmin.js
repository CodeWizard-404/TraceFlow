const axios = require('axios');
const { sequelize, User, Role, Permission } = require('../models');
const { migratePermissionsToKeycloak: migrateRecourcesToKeycloak } = require('./migrateRe');
const { migratePermissionsToKeycloak } = require('./migratePe');
const { migratePoliciesToKeycloak } = require('./migratePo');

require('dotenv').config();

const SUPER_ADMIN_CONFIG = {
    email: process.env.SUPER_ADMIN_EMAIL,
    password: process.env.SUPER_ADMIN_PASSWORD,
    firstname: 'Super',
    lastname: 'Admin',
    phone: '00000000',
    roleName: 'Super Admin',
};

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';

async function getAdminToken() {
    const response = await axios.post(
        `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
        new URLSearchParams({
            grant_type: 'password',
            client_id: 'admin-cli',
            username: process.env.KEYCLOAK_ADMIN_USER || 'admin',
            password: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
        })
    );
    return response.data.access_token;
}

async function getClientUUID(token) {
    const response = await axios.get(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const client = response.data.find(c => c.clientId === CLIENT_ID);
    if (!client) throw new Error(`Client ${CLIENT_ID} not found`);
    return client.id;
}

async function createOrUpdateKeycloakUser(token, email, password, firstname, lastname, phone) {
    const userCheck = await axios.get(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/users?email=${email}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );

    let keycloakId;
    if (userCheck.data.length > 0) {
        keycloakId = userCheck.data[0].id;
        await axios.put(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${keycloakId}/reset-password`,
            { type: 'password', value: password, temporary: false },
            { headers: { Authorization: `Bearer ${token}` } }
        );
    } else {
        await axios.post(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users`,
            {
                username: email,
                email,
                firstName: firstname,
                lastName: lastname,
                enabled: true,
                attributes: { phone },
                credentials: [{ type: 'password', value: password, temporary: false }],
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const createdUser = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users?email=${email}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        keycloakId = createdUser.data[0].id;
    }
    return keycloakId;
}

async function syncSuperAdminRoleToKeycloak(token) {
    let roleId;
    try {
        const roleCheck = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${SUPER_ADMIN_CONFIG.roleName}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        roleId = roleCheck.data.id;
    } catch (error) {
        if (error.response?.status === 404) {
            await axios.post(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/roles`,
                {
                    name: SUPER_ADMIN_CONFIG.roleName,
                    description: 'Role with full administrative privileges',
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const newRole = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${SUPER_ADMIN_CONFIG.roleName}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            roleId = newRole.data.id;
        } else {
            throw error;
        }
    }
    return roleId;
}

async function seedSuperAdmin() {
    try {
        await sequelize.sync({ alter: true });
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);

        // Seed Super Admin user in Keycloak and local DB
        const keycloakId = await createOrUpdateKeycloakUser(
            token,
            SUPER_ADMIN_CONFIG.email,
            SUPER_ADMIN_CONFIG.password,
            SUPER_ADMIN_CONFIG.firstname,
            SUPER_ADMIN_CONFIG.lastname,
            SUPER_ADMIN_CONFIG.phone,
        );

        // Seed Super Admin role in local DB
        const [superAdminRole] = await Role.findOrCreate({
            where: { name: SUPER_ADMIN_CONFIG.roleName },
            defaults: {
                roleID: `role_${Math.random().toString(36).substr(2, 9)}`,
                name: SUPER_ADMIN_CONFIG.roleName,
                description: 'Role with full administrative privileges',
            },
        });

        // Seed permissions to Super Admin role in local DB only
        const allPermissions = await Permission.findAll();
        if (allPermissions.length === 0) {
            throw new Error('No permissions found to assign to Super Admin role');
        }
        const currentPermissions = await superAdminRole.getPermissions();
        const currentPermissionIDs = currentPermissions.map(p => p.permissionID);
        for (const permission of allPermissions) {
            if (!currentPermissionIDs.includes(permission.permissionID)) {
                await superAdminRole.addPermission(permission);
            }
        }

        // Seed Super Admin user in local DB
        const [superAdminUser, userCreated] = await User.findOrCreate({
            where: { email: SUPER_ADMIN_CONFIG.email },
            defaults: {
                userID: `user_${Math.random().toString(36).substr(2, 9)}`,
                email: SUPER_ADMIN_CONFIG.email,
                password: 'keycloak_managed',
                firstname: SUPER_ADMIN_CONFIG.firstname,
                lastname: SUPER_ADMIN_CONFIG.lastname,
                phone: SUPER_ADMIN_CONFIG.phone,
                keycloakId: keycloakId,
            },
        });

        if (!userCreated && !superAdminUser.keycloakId) {
            await superAdminUser.update({ keycloakId });
        }

        // Assign Super Admin role to user in local DB
        const currentRoles = await superAdminUser.getRoles();
        const currentRoleIDs = currentRoles.map(r => r.roleID);
        if (!currentRoleIDs.includes(superAdminRole.roleID)) {
            await superAdminUser.addRole(superAdminRole);
        }

        // Sync Super Admin role to Keycloak (no permissions)
        const roleId = await syncSuperAdminRoleToKeycloak(token);

        // Assign Super Admin role to user in Keycloak
        const roleMappingCheck = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${keycloakId}/role-mappings/realm`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const hasRole = roleMappingCheck.data.some(role => role.name === SUPER_ADMIN_CONFIG.roleName);
        if (!hasRole) {
            await axios.post(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${keycloakId}/role-mappings/realm`,
                [{ id: roleId, name: SUPER_ADMIN_CONFIG.roleName }],
                { headers: { Authorization: `Bearer ${token}` } }
            );
        }

        await migratePoliciesToKeycloak();
        await migrateRecourcesToKeycloak();
        await migratePermissionsToKeycloak();


    } catch (error) {

        throw error;
    }
}

module.exports = { seedSuperAdmin };

if (require.main === module) {
    seedSuperAdmin();
}