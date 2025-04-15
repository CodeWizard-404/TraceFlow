const axios = require('axios');
const path = require('path');
const { sequelize } = require('../models');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });



// Keycloak config
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';

async function getAdminToken() {
    try {
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
    } catch (err) {
        throw new Error(`Failed to get admin token: ${err.response?.data?.error_description || err.message}`);
    }
}

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

async function getExistingResources(token, clientUUID) {
    try {
        const response = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (err) {
        throw new Error(`Failed to fetch resources: ${err.response?.data?.error_description || err.message}`);
    }
}

async function getExistingPolicies(token, clientUUID) {
    try {
        const response = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data.filter(policy => policy.type === 'role');
    } catch (err) {
        throw new Error(`Failed to fetch policies: ${err.response?.data?.error_description || err.message}`);
    }
}

async function getExistingPermissions(token, clientUUID) {
    try {
        const response = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (err) {
        throw new Error(`Failed to fetch permissions: ${err.response?.data?.error_description || err.message}`);
    }
}

async function deletePermission(token, clientUUID, permissionId) {
    try {
        await axios.delete(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/${permissionId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`${new Date().toISOString()} - Deleted permission: ${permissionId}`);
    } catch (err) {
        console.error(`Failed to delete permission ${permissionId}: ${err.response?.data?.error_description || err.message}`);
    }
}

const migratePermissionsToKeycloak = async () => {
    try {
        // Verify database connection
        await sequelize.authenticate();
        console.log(`${new Date().toISOString()} - Database connection successful`);

        // Get Keycloak token and client
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);

        // Fetch Keycloak data
        const keycloakResources = await getExistingResources(token, clientUUID);
        const keycloakPolicies = await getExistingPolicies(token, clientUUID);

        // Delete existing permissions
        const existingPermissions = await getExistingPermissions(token, clientUUID);
        if (existingPermissions.length > 0) {
            console.log(`${new Date().toISOString()} - Deleting ${existingPermissions.length} existing permissions`);
            await Promise.all(existingPermissions.map(perm => deletePermission(token, clientUUID, perm.id)));
            console.log(`${new Date().toISOString()} - All permissions deleted`);
        } else {
            console.log(`${new Date().toISOString()} - No existing permissions found`);
        }

        // Fetch permissions with roles using raw query
        console.log(`${new Date().toISOString()} - Fetching permissions with roles...`);
        const [dbPermissions] = await sequelize.query(`
      SELECT p."permissionID", p.name AS permission_name, array_agg(r.name) AS role_names
      FROM "Permissions" p
      LEFT JOIN "RolePermissions" rp ON p."permissionID" = rp."permissionID"
      LEFT JOIN "Roles" r ON rp."roleID" = r."roleID"
      GROUP BY p."permissionID", p.name
    `);

        console.log(`${new Date().toISOString()} - Found ${dbPermissions.length} permissions`);

        if (dbPermissions.length === 0) {
            console.warn(`${new Date().toISOString()} - No permissions found, exiting`);
            return;
        }

        // Process permissions
        for (const dbPerm of dbPermissions) {
            const permName = dbPerm.permission_name;
            console.log(`${new Date().toISOString()} - Processing permission: ${permName}`);

            // Find matching resource
            const resource = keycloakResources.find(r => r.name === permName);
            if (!resource) {
                console.warn(`${new Date().toISOString()} - No resource found for ${permName}, skipping`);
                continue;
            }

            // Get role names
            const roleNames = dbPerm.role_names ? dbPerm.role_names.filter(name => name) : [];
            console.log(`${new Date().toISOString()} - Roles for ${permName}: ${roleNames.join(', ') || 'none'}`);

            if (roleNames.length === 0) {
                console.warn(`${new Date().toISOString()} - No roles for ${permName}, skipping`);
                continue;
            }

            // Find matching policies
            const policyIds = roleNames
                .map(roleName => {
                    const policy = keycloakPolicies.find(p => p.name === `${roleName}-policy`);
                    return policy ? policy.id : null;
                })
                .filter(id => id);

            if (policyIds.length === 0) {
                console.warn(`${new Date().toISOString()} - No policies found for ${permName}, skipping`);
                continue;
            }

            // Create permission
            const permissionName = `${permName}-permission`;
            try {
                await axios.post(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/resource`,
                    {
                        name: permissionName,
                        type: 'resource',
                        resources: [resource._id],
                        policies: policyIds,
                        scopes: resource.scopes ? resource.scopes.map(s => s.name) : [],
                        logic: 'POSITIVE',
                        decisionStrategy: 'AFFIRMATIVE',
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log(`${new Date().toISOString()} - Created permission: ${permissionName} with ${policyIds.length} policies`);
            } catch (err) {
                console.error(`${new Date().toISOString()} - Failed to create permission ${permissionName}: ${err.response?.data?.error_description || err.message}`);
            }
        }

        console.log(`${new Date().toISOString()} - Migration complete`);
    } catch (error) {
        console.error(`${new Date().toISOString()} - Migration error:`, error.message);
        throw error;
    }
};

if (require.main === module) {
    migratePermissionsToKeycloak().catch(err => {
        console.error('Migration failed:', err.message);
        process.exit(1);
    });
}

module.exports = { migratePermissionsToKeycloak };