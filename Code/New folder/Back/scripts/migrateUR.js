const axios = require('axios');
const path = require('path');
const { User, Role, sequelize } = require('../models');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Keycloak config from .env
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const KEYCLOAK_ADMIN_USER = process.env.KEYCLOAK_ADMIN_USER || 'admin';
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';

// Get Keycloak admin token
async function getAdminToken() {
    try {
        const response = await axios.post(
            `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: 'password',
                client_id: 'admin-cli',
                username: KEYCLOAK_ADMIN_USER,
                password: KEYCLOAK_ADMIN_PASSWORD,
            })
        );
        return response.data.access_token;
    } catch (err) {
        throw new Error(`Failed to get admin token: ${err.response?.data?.error_description || err.message}`);
    }
}

// Fetch the client UUID
async function getClientUUID(token) {
    try {
        const response = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const client = response.data.find(c => c.clientId === CLIENT_ID);
        if (!client) throw new Error(`Client ${CLIENT_ID} not found in realm ${REALM}`);
        return client.id;
    } catch (err) {
        throw new Error(`Failed to get client UUID: ${err.response?.data?.error_description || err.message}`);
    }
}

// Fetch all existing users from Keycloak
async function getKeycloakUsers(token) {
    try {
        const response = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (err) {
        throw new Error(`Failed to fetch Keycloak users: ${err.response?.data?.error_description || err.message}`);
    }
}

// Delete a single user from Keycloak
async function deleteKeycloakUser(token, userId) {
    try {
        await axios.delete(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
    } catch (err) {
        console.error(`${new Date().toISOString()} - Failed to delete user ${userId}: ${err.response?.data?.error_description || err.message}`);
    }
}

// Fetch all existing roles from Keycloak
async function getKeycloakRoles(token) {
    try {
        const response = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/roles`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (err) {
        throw new Error(`Failed to fetch Keycloak roles: ${err.response?.data?.error_description || err.message}`);
    }
}

// Delete a single role from Keycloak
async function deleteKeycloakRole(token, roleName, clientUUID) {
    try {
        // Delete associated policy first
        try {
            const policyResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role?name=${roleName}-policy`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (policyResponse.data[0]?.id) {
                await axios.delete(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/${policyResponse.data[0].id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
        } catch (err) {
            if (err.response?.status !== 404) {
                console.error(`${new Date().toISOString()} - Failed to delete policy for role ${roleName}: ${err.message}`);
            }
        }

        // Delete role
        await axios.delete(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${roleName}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
    } catch (err) {
        console.error(`${new Date().toISOString()} - Failed to delete role ${roleName}: ${err.response?.data?.error_description || err.message}`);
    }
}

// Create a user in Keycloak
async function createKeycloakUser(token, user) {
    try {
        const response = await axios.post(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users`,
            {
                username: user.email,
                email: user.email,
                firstName: user.firstname || '',
                lastName: user.lastname || '',
                enabled: true,
                credentials: [{ type: 'password', value: 'defaultPassword123!', temporary: true }],
                attributes: { phone: user.phone || '' },
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.headers.location.split('/').pop();
    } catch (err) {
        throw new Error(`Failed to create user ${user.email}: ${err.response?.data?.error_description || err.message}`);
    }
}

// Create a role in Keycloak
async function createKeycloakRole(token, role, clientUUID) {
    try {
        // Check if role already exists
        try {
            const existingRole = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return existingRole.data.id;
        } catch (err) {
            if (err.response?.status !== 404) throw err;
        }

        // Create new role
        await axios.post(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/roles`,
            { name: role.name, description: role.description || `Role ${role.name}` },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        // Fetch role ID
        const roleResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const roleId = roleResponse.data.id;

        // Create policy for the role
        await axios.post(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role`,
            {
                name: `${role.name}-policy`,
                description: `Policy for ${role.name} role`,
                logic: 'POSITIVE',
                type: 'role',
                roles: [{ id: roleId, required: true }],
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        return roleId;
    } catch (err) {
        throw new Error(`Failed to create role ${role.name}: ${err.response?.data?.error_description || err.message}`);
    }
}

// Assign roles to a user in Keycloak
async function assignRolesToKeycloakUser(token, keycloakUserId, userEmail, roles) {
    try {
        const roleMappings = [];
        for (const role of roles) {
            try {
                const roleData = await axios.get(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                roleMappings.push({ id: roleData.data.id, name: role.name });
            } catch (err) {
                if (err.response?.status === 404) {
                    console.warn(`${new Date().toISOString()} - Role ${role.name} not found in Keycloak for user ${userEmail}, skipping assignment`);
                    continue;
                }
                console.error(`${new Date().toISOString()} - Error checking role ${role.name} for user ${userEmail}: ${err.message}`);
                throw err;
            }
        }

        if (roleMappings.length === 0) {
            console.log(`${new Date().toISOString()} - No valid roles to assign to user ${userEmail}`);
            return;
        }

        await axios.post(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${keycloakUserId}/role-mappings/realm`,
            roleMappings,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`${new Date().toISOString()} - Assigned ${roleMappings.length} roles to user ${userEmail}: ${roleMappings.map(r => r.name).join(', ')}`);
    } catch (err) {
        console.error(`${new Date().toISOString()} - Failed to assign roles to user ${userEmail}: ${err.response?.data?.error_description || err.message}`);
    }
}

// Main migration function
const syncUsersAndRolesToKeycloak = async () => {
    try {
        // Step 1: Get admin token and client UUID
        const token = await getAdminToken();
        console.log(`${new Date().toISOString()} - Obtained admin token`);
        const clientUUID = await getClientUUID(token);
        console.log(`${new Date().toISOString()} - Obtained client UUID: ${clientUUID}`);

        // Step 2: Fetch local database users and roles
        let localUsers = [];
        let localRoles = [];
        let rolesAvailable = true;

        // Check if UserRoles table exists
        try {
            await sequelize.query('SELECT 1 FROM "UserRoles" LIMIT 1');
            console.log(`${new Date().toISOString()} - UserRoles table exists`);
        } catch (err) {
            console.warn(`${new Date().toISOString()} - UserRoles table does not exist or is inaccessible: ${err.message}`);
            rolesAvailable = false;
        }

        // Fetch users
        try {
            if (rolesAvailable) {
                localUsers = await User.findAll({
                    include: [{
                        model: Role,
                        through: { model: 'UserRoles', attributes: [] },
                        attributes: ['name', 'description', 'roleID'],
                    }],
                });
            } else {
                localUsers = await User.findAll();
            }
            console.log(`${new Date().toISOString()} - Fetched ${localUsers.length} users from database`);
        } catch (err) {
            console.error(`${new Date().toISOString()} - Failed to fetch users: ${err.message}`);
            throw new Error(`Failed to fetch users: ${err.message}`);
        }

        // Fetch roles
        try {
            localRoles = await Role.findAll();
            console.log(`${new Date().toISOString()} - Fetched ${localRoles.length} roles from database`);
        } catch (err) {
            console.error(`${new Date().toISOString()} - Failed to fetch roles: ${err.message}`);
            throw new Error(`Failed to fetch roles: ${err.message}`);
        }

        if (!localUsers.length && !localRoles.length) {
            console.log(`${new Date().toISOString()} - No users or roles found in local database, nothing to sync`);
            return;
        }

        // Step 3: Delete all existing users in Keycloak
        const keycloakUsers = await getKeycloakUsers(token);
        if (keycloakUsers.length > 0) {
            await Promise.all(
                keycloakUsers.map(user => deleteKeycloakUser(token, user.id))
            );
            console.log(`${new Date().toISOString()} - Deleted ${keycloakUsers.length} existing users from Keycloak`);
        } else {
            console.log(`${new Date().toISOString()} - No existing users found in Keycloak`);
        }

        // Step 4: Delete all roles in Keycloak
        const keycloakRoles = await getKeycloakRoles(token);
        if (keycloakRoles.length > 0) {
            await Promise.all(
                keycloakRoles.map(role => deleteKeycloakRole(token, role.name, clientUUID))
            );
            console.log(`${new Date().toISOString()} - Deleted ${keycloakRoles.length} roles from Keycloak`);
        } else {
            console.log(`${new Date().toISOString()} - No roles found in Keycloak`);
        }

        // Step 5: Create roles in Keycloak
        const roleIdMap = new Map();
        for (const role of localRoles) {
            try {
                if (!role.name) {
                    console.warn(`${new Date().toISOString()} - Skipping role with missing name: roleID=${role.roleID}`);
                    continue;
                }
                const roleId = await createKeycloakRole(token, role, clientUUID);
                roleIdMap.set(role.name, roleId);
                console.log(`${new Date().toISOString()} - Created role ${role.name} in Keycloak with ID ${roleId}`);
            } catch (err) {
                console.error(`${new Date().toISOString()} - Failed to create role ${role.name || role.roleID}: ${err.message}`);
            }
        }

        // Step 6: Create users in Keycloak and assign roles
        for (const user of localUsers) {
            try {
                if (!user.email) {
                    console.warn(`${new Date().toISOString()} - Skipping user with missing email: userID=${user.userID}`);
                    continue;
                }

                const keycloakUserId = await createKeycloakUser(token, user);
                await user.update({ keycloakId: keycloakUserId });
                console.log(`${new Date().toISOString()} - Created user ${user.email} in Keycloak with ID ${keycloakUserId}`);

                if (rolesAvailable && user.Roles && user.Roles.length > 0) {
                    await assignRolesToKeycloakUser(token, keycloakUserId, user.email, user.Roles);
                } else {
                    console.log(`${new Date().toISOString()} - No roles to assign to user ${user.email} (rolesAvailable: ${rolesAvailable})`);
                }
            } catch (err) {
                console.error(`${new Date().toISOString()} - Failed to process user ${user.email || user.userID}: ${err.message}`);
            }
        }

        console.log(`${new Date().toISOString()} - Keycloak users and roles synchronization complete`);
    } catch (error) {
        console.error(`${new Date().toISOString()} - Error syncing users and roles to Keycloak: ${error.message}`);
        throw error;
    }
};

// Execute if run directly
if (require.main === module) {
    syncUsersAndRolesToKeycloak().catch(err => {
        console.error('Synchronization failed:', err.message);
        process.exit(1);
    });
}

module.exports = { syncUsersAndRolesToKeycloak };