const axios = require('axios');
const path = require('path');
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

// Fetch all existing role-based policies
async function getExistingPolicies(token, clientUUID) {
    try {
        const response = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data.filter(policy => policy.type === 'role');
    } catch (err) {
        throw new Error(`Failed to fetch existing policies: ${err.response?.data?.error_description || err.message}`);
    }
}

// Delete a single policy
async function deletePolicy(token, clientUUID, policyId) {
    try {
        await axios.delete(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/${policyId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`${new Date().toISOString()} - Deleted Keycloak policy with ID: ${policyId}`);
    } catch (err) {
        console.error(`Failed to delete policy ${policyId}: ${err.response?.data?.error_description || err.message}`);
    }
}

// Fetch all roles from Keycloak realm
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

// Migrate policies to Keycloak based on existing Keycloak roles
const migratePoliciesToKeycloak = async () => {
    try {
        // Step 1: Get admin token and client UUID
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);

        // Step 2: Delete all existing role-based policies
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

        // Step 3: Fetch all roles from Keycloak
        const keycloakRoles = await getKeycloakRoles(token);
        if (keycloakRoles.length === 0) {
            console.warn(`${new Date().toISOString()} - No roles found in Keycloak, nothing to migrate`);
            return;
        }

        console.log(`${new Date().toISOString()} - Found ${keycloakRoles.length} roles in Keycloak`);

        // Step 4: Create policies for each Keycloak role
        for (const role of keycloakRoles) {
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
                console.error(`${new Date().toISOString()} - Failed to create policy for ${role.name}: ${err.response?.data?.error_description || err.message}`);
            }
        }

        console.log(`${new Date().toISOString()} - Keycloak policies migration complete`);
    } catch (error) {
        console.error(`${new Date().toISOString()} - Error migrating policies to Keycloak:`, error.message);
        throw error;
    }
};

// Execute if run directly
if (require.main === module) {
    migratePoliciesToKeycloak().catch(err => {
        console.error('Migration failed:', err.message);
        process.exit(1);
    });
}

module.exports = { migratePoliciesToKeycloak };