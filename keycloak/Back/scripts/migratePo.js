const axios = require('axios');
const { Role } = require('../models');
require('dotenv').config();

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';

async function getAdminToken() {
    const response = await axios.post(
        `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
        new URLSearchParams({
            grant_type: 'password',
            client_id: 'admin-cli',
            username: ADMIN_USER,
            password: ADMIN_PASS,
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
    if (!client) throw new Error(`Client ${CLIENT_ID} not found in realm ${REALM}`);
    return client.id;
}

// Fetch all existing policies
async function getExistingPolicies(token, clientUUID) {
    const response = await axios.get(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.filter(policy => policy.type === 'role'); // Only role-based policies
}

// Delete a single policy
async function deletePolicy(token, clientUUID, policyId) {
    await axios.delete(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/${policyId}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log(`${new Date().toISOString()} - Deleted Keycloak policy with ID: ${policyId}`);
}

// Sync a local role to Keycloak and return its Keycloak ID
async function syncRoleToKeycloak(token, role) {
    try {
        const response = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data.id; // Role already exists
    } catch (err) {
        if (err.response?.status === 404) {
            await axios.post(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/roles`,
                {
                    name: role.name,
                    description: role.description || `Role: ${role.name}`,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const newRoleResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log(`${new Date().toISOString()} - Synced role to Keycloak: ${role.name}`);
            return newRoleResponse.data.id;
        }
        throw err;
    }
}

// Migrate policies to Keycloak
const migratePoliciesToKeycloak = async () => {
    try {
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);

        // Step 1: Delete all existing role-based policies
        const existingPolicies = await getExistingPolicies(token, clientUUID);
        if (existingPolicies.length > 0) {
            console.log(`${new Date().toISOString()} - Found ${existingPolicies.length} existing role-based policies, deleting...`);
            await Promise.all(
                existingPolicies.map(policy => deletePolicy(token, clientUUID, policy.id))
            );
            console.log(`${new Date().toISOString()} - All existing role-based policies deleted`);
        } else {
            console.log(`${new Date().toISOString()} - No existing role-based policies found`);
        }

        // Step 2: Fetch roles from local DB and sync to Keycloak
        const localRoles = await Role.findAll();
        if (localRoles.length === 0) {
            console.warn(`${new Date().toISOString()} - No roles found in local database, nothing to migrate`);
            return;
        }

        const syncedRoles = [];
        for (const role of localRoles) {
            const keycloakRoleId = await syncRoleToKeycloak(token, role);
            syncedRoles.push({ name: role.name, id: keycloakRoleId });
            // Optionally update local DB with Keycloak ID if you add a keycloakId field
            // await role.update({ keycloakId: keycloakRoleId });
        }

        // Step 3: Create policies for synced roles
        for (const role of syncedRoles) {
            try {
                await axios.post(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role`,
                    {
                        name: `${role.name}-policy`,
                        description: `Policy for ${role.name} role`,
                        logic: 'POSITIVE',
                        type: 'role',
                        roles: [{ id: role.id, required: true }],
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log(`${new Date().toISOString()} - Created Keycloak policy for role: ${role.name}`);
            } catch (err) {
                console.error(`Failed to create policy for ${role.name}:`, err.response?.data || err.message);
            }
        }

        console.log(`${new Date().toISOString()} - Keycloak policies migration complete`);
    } catch (error) {
        console.error('Error migrating policies to Keycloak:', error);
        throw error;
    }
};

// Execute if run directly
if (require.main === module) {
    migratePoliciesToKeycloak().catch(console.error);
}

module.exports = { migratePoliciesToKeycloak };