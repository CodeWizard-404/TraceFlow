const axios = require('axios');
const { Role, Permission } = require('../models');
const { setupAssociations } = require('../models');
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
    if (!client) throw new Error(`Client ${CLIENT_ID} not found`);
    return client.id;
}

async function migratePermissionsKeycloakAssignments() {
    try {
        setupAssociations();
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);

        // Get roles and their permissions from database
        const roles = await Role.findAll({
            include: [{ model: Permission, through: { attributes: [] } }],
        });
        console.log('Roles found in database:', roles.map(r => ({
            name: r.name,
            permissions: r.Permissions.map(p => p.name),
        })));

        // Get policies from Keycloak
        const policiesResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const policies = policiesResponse.data;
        console.log('Policies in Keycloak:', policies.map(p => p.name));

        // Get resources from Keycloak
        const resourcesResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const resources = resourcesResponse.data;
        console.log('Resources in Keycloak:', resources.map(r => r.name));

        // Get existing permissions
        const permissionsResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const existingPermissions = permissionsResponse.data;

        // Build a map of permissions to all their policies
        const permissionPolicyMap = {};
        for (const role of roles) {
            const rolePolicy = policies.find(p => p.name === `${role.name}-policy`);
            if (!rolePolicy) {
                console.log(`Policy for ${role.name} not found, skipping.`);
                continue;
            }

            for (const perm of role.Permissions) {
                const resource = resources.find(r => r.name === perm.name);
                if (!resource) {
                    console.log(`Resource ${perm.name} not found for ${role.name}, skipping.`);
                    continue;
                }

                const permissionName = `${perm.name}-permission`;
                if (!permissionPolicyMap[permissionName]) {
                    permissionPolicyMap[permissionName] = {
                        resourceId: resource._id,
                        policies: new Set(),
                    };
                }
                permissionPolicyMap[permissionName].policies.add(rolePolicy.id);
            }
        }

        // Create or update permissions with all policies
        for (const [permissionName, { resourceId, policies: policySet }] of Object.entries(permissionPolicyMap)) {
            const policyIds = Array.from(policySet);
            const existingPermission = existingPermissions.find(p => p.name === permissionName);

            if (existingPermission) {
                // Update existing permission with all policies
                const currentPolicies = existingPermission.policies || [];
                const updatedPolicies = [...new Set([...currentPolicies, ...policyIds])]; // Merge without duplicates
                if (updatedPolicies.length !== currentPolicies.length) {
                    await axios.put(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/resource/${existingPermission.id}`,
                        {
                            name: permissionName,
                            description: `Permission for ${permissionName.replace('-permission', '')}`,
                            type: 'resource',
                            resources: [resourceId],
                            policies: updatedPolicies,
                            decisionStrategy: 'UNANIMOUS',
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    console.log(`Updated ${permissionName} with policies: ${updatedPolicies.map(id => policies.find(p => p.id === id)?.name || id).join(', ')}`);
                } else {
                    console.log(`${permissionName} already has all policies: ${currentPolicies.map(id => policies.find(p => p.id === id)?.name || id).join(', ')}`);
                }
            } else {
                // Create new permission with all policies
                await axios.post(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/resource`,
                    {
                        name: permissionName,
                        description: `Permission for ${permissionName.replace('-permission', '')}`,
                        type: 'resource',
                        resources: [resourceId],
                        policies: policyIds,
                        decisionStrategy: 'UNANIMOUS',
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log(`Created ${permissionName} with policies: ${policyIds.map(id => policies.find(p => p.id === id)?.name || id).join(', ')}`);
            }
        }

        console.log('Permissions assignment complete!');
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        throw error;
    }
}

if (require.main === module) {
    migratePermissionsKeycloakAssignments().catch(console.error);
}

module.exports = { migratePermissionsKeycloakAssignments };