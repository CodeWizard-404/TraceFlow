const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { extractPermissionsFromFiles } = require('./seedPermissions'); // Reuse
require('dotenv').config();

// Keycloak config from .env
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';

// Get Keycloak admin token
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

// Fetch the client UUID
async function getClientUUID(token) {
    const response = await axios.get(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const client = response.data.find(c => c.clientId === CLIENT_ID);
    if (!client) throw new Error(`Client ${CLIENT_ID} not found in realm ${REALM}`);
    return client.id;
}

// Migrate resources to Keycloak
const migratePermissionsToKeycloak = async () => {
    try {
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);
        const permissions = await extractPermissionsFromFiles();

        for (const perm of permissions) {
            const resourceName = `${perm.route}/*`;
            const resourceUri = `${perm.route}/${perm.name}`;
            try {
                await axios.post(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource`,
                    {
                        name: perm.name,
                        type: 'urn:traceflow:resources:route',
                        uris: [resourceName, resourceUri],
                        scopes: [{ name: 'access' }],
                        attributes: { class: perm.class },
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log(`${new Date().toISOString()} - Created Keycloak resource: ${perm.name}`);
            } catch (err) {
                if (err.response?.status !== 409) {
                    console.error(`Failed to create resource ${perm.name}:`, err.response?.data || err.message);
                }
            }
        }

        console.log(`${new Date().toISOString()} - Keycloak resources migration complete`);
    } catch (error) {
        console.error('Error migrating resources to Keycloak:', error);
        throw error;
    }
};

// Execute if run directly
if (require.main === module) {
    migratePermissionsToKeycloak().catch(console.error);
}

module.exports = { migratePermissionsToKeycloak };