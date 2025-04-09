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

// Migrate policies to Keycloak
const migratePoliciesToKeycloak = async () => {
    try {
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);

        // Fetch roles from Keycloak (since your DB roles might not match yet)
        const rolesResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/roles`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const keycloakRoles = rolesResponse.data;

        for (const role of keycloakRoles) {
            // Skip default Keycloak roles
            if (['uma_authorization', 'offline_access', 'default-roles-traceflow'].includes(role.name)) continue;

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
                if (err.response?.status !== 409) {
                    console.error(`Failed to create policy for ${role.name}:`, err.response?.data || err.message);
                }
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