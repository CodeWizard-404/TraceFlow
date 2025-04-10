const axios = require('axios');
const { sequelize, User, Role, Permission } = require('../models');
require('dotenv').config();

const SUPER_ADMIN_CONFIG = {
    email: process.env.SUPER_ADMIN_EMAIL,
    password: process.env.SUPER_ADMIN_PASSWORD,
    firstname: 'Super',
    lastname: 'Admin',
    phone: '00-000-000',
    wallet: '0000-0000-0000-0000',
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

async function createOrUpdateKeycloakUser(token, email, password, firstname, lastname, phone, wallet) {
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
                attributes: { phone, wallet },
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

async function syncSuperAdminToKeycloak(token, clientUUID, superAdminRole, allPermissions) {
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

    const policyName = `${SUPER_ADMIN_CONFIG.roleName}-policy`;
    let policyId;
    try {
        const policyCheck = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role?name=${policyName}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        policyId = policyCheck.data[0]?.id;
    } catch (error) {
        if (error.response?.status === 404) {
            await axios.post(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role`,
                {
                    name: policyName,
                    description: `Policy for ${SUPER_ADMIN_CONFIG.roleName} role`,
                    logic: 'POSITIVE',
                    type: 'role',
                    roles: [{ id: roleId, required: true }],
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const policy = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role?name=${policyName}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            policyId = policy.data[0].id;
        } else {
            throw error;
        }
    }

    const resources = await axios.get(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const resourceMap = new Map(resources.data.map(r => [r.name, r._id]));

    const permissionsResponse = await axios.get(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const permissionMap = new Map(permissionsResponse.data.map(p => [p.name, p]));

    for (const perm of allPermissions) {
        const permissionName = `${perm.name}-permission`;
        const resourceId = resourceMap.get(perm.name);
        if (!resourceId) continue;

        const existingPermission = permissionMap.get(permissionName);
        if (existingPermission) {
            const currentPolicies = Array.isArray(existingPermission.policies) ? existingPermission.policies : [];
            if (!currentPolicies.includes(policyId)) {
                await axios.put(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/${existingPermission.id}`,
                    {
                        name: permissionName,
                        description: `Permission for ${perm.name}`,
                        type: 'resource',
                        resources: [resourceId],
                        policies: [...currentPolicies, policyId],
                        decisionStrategy: 'AFFIRMATIVE',
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
        } else {
            await axios.post(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/resource`,
                {
                    name: permissionName,
                    description: `Permission for ${perm.name}`,
                    type: 'resource',
                    resources: [resourceId],
                    policies: [policyId],
                    decisionStrategy: 'AFFIRMATIVE',
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        }
    }

    return roleId;
}

async function seedSuperAdmin() {
    try {
        await sequelize.sync({ alter: true });
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);

        const keycloakId = await createOrUpdateKeycloakUser(
            token,
            SUPER_ADMIN_CONFIG.email,
            SUPER_ADMIN_CONFIG.password,
            SUPER_ADMIN_CONFIG.firstname,
            SUPER_ADMIN_CONFIG.lastname,
            SUPER_ADMIN_CONFIG.phone,
            SUPER_ADMIN_CONFIG.wallet
        );

        const [superAdminRole] = await Role.findOrCreate({
            where: { name: SUPER_ADMIN_CONFIG.roleName },
            defaults: {
                roleID: `role_${Math.random().toString(36).substr(2, 9)}`,
                name: SUPER_ADMIN_CONFIG.roleName,
                description: 'Role with full administrative privileges',
            },
        });

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

        if (!userCreated && !superAdminUser.keycloakId) {
            await superAdminUser.update({ keycloakId });
        }

        const currentRoles = await superAdminUser.getRoles();
        const currentRoleIDs = currentRoles.map(r => r.roleID);
        if (!currentRoleIDs.includes(superAdminRole.roleID)) {
            await superAdminUser.addRole(superAdminRole);
        }

        const roleId = await syncSuperAdminToKeycloak(token, clientUUID, superAdminRole, allPermissions);

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

        // Always show credentials in development, whether created or existing
        if (process.env.NODE_ENV === 'development') {
            console.log(`\n\x1b[31mSuper Admin Credentials:`);
            console.log(`\tEmail:\t\t${SUPER_ADMIN_CONFIG.email}`);
            console.log(`\tPassword:\t${SUPER_ADMIN_CONFIG.password}\x1b[0m\n`);
        }
    } catch (error) {
        console.error('Error seeding Super Admin:', error);
        throw error;
    }
}

module.exports = { seedSuperAdmin };

if (require.main === module) {
    seedSuperAdmin();
}