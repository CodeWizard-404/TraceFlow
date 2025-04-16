const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { extractRoutePermissions } = require('./seedPermissions');
require('dotenv').config();

// Keycloak config from .env
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const KEYCLOAK_ADMIN_USER = process.env.KEYCLOAK_ADMIN_USER || 'admin';
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';

// Get Keycloak admin token
async function getAdminToken() {
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

// Fetch all existing resources
async function getExistingResources(token, clientUUID) {
    const response = await axios.get(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
}

// Delete a single resource
async function deleteResource(token, clientUUID, resourceId) {
    await axios.delete(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource/${resourceId}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log(`${new Date().toISOString()} - Deleted Keycloak resource with ID: ${resourceId}`);
}

// Determine CRUD scope based on permission name
function getScopeFromPermissionName(permissionName) {
    if (permissionName.includes('access') || permissionName.includes('read') || permissionName.includes('get')) {
        return 'read';
    } else if (permissionName.includes('create') || permissionName.includes('post')) {
        return 'write';
    } else if (permissionName.includes('update') || permissionName.includes('put')) {
        return 'update';
    } else if (permissionName.includes('delete')) {
        return 'delete';
    }
    return 'access'; // Default fallback
}

// Migrate resources to Keycloak (delete existing and replace)
const migratePermissionsToKeycloak = async () => {
    try {
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);

        // Step 1: Fetch and delete all existing resources
        const existingResources = await getExistingResources(token, clientUUID);
        if (existingResources.length > 0) {
            console.log(`${new Date().toISOString()} - Found ${existingResources.length} existing resources, deleting...`);
            await Promise.all(
                existingResources.map(resource => deleteResource(token, clientUUID, resource._id))
            );
            console.log(`${new Date().toISOString()} - All existing resources deleted`);
        } else {
            console.log(`${new Date().toISOString()} - No existing resources found`);
        }

        // Step 2: Extract new permissions and create resources
        const permissions = await extractRoutePermissions();

        for (const perm of permissions) {
            if (!perm.route || perm.route === '/api/unknown') {
                console.warn(`${new Date().toISOString()} - Skipping permission ${perm.name} due to undefined or unknown route`);
                continue;
            }

            const resourceName = perm.route;
            const scope = getScopeFromPermissionName(perm.name);

            try {
                await axios.post(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource`,
                    {
                        name: perm.name,
                        type: 'urn:traceflow:resources:route',
                        uris: [resourceName],
                        scopes: [{ name: scope }],
                        attributes: { class: perm.class },
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log(`${new Date().toISOString()} - Created Keycloak resource: ${perm.name} for route ${resourceName} with scope ${scope}`);
            } catch (err) {
                console.error(`Failed to create resource ${perm.name}:`, err.response?.data || err.message);
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