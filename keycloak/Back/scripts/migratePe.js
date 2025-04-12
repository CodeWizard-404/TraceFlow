const axios = require('axios');
const { Role, Permission, sequelize } = require('../models');
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

        const roles = await Role.findAll({
            include: [{ model: Permission, through: { attributes: [] } }],
        });

        const policiesResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const policies = policiesResponse.data;

        const resourcesResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const resources = resourcesResponse.data;

        const permissionsResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const existingPermissions = permissionsResponse.data;

        const permissionPolicyMap = {};
        for (const role of roles) {
            const rolePolicy = policies.find(p => p.name === `${role.name}-policy`);
            if (!rolePolicy) {
                continue;
            }

            for (const perm of role.Permissions) {
                const resource = resources.find(r => r.name === perm.name);
                if (!resource) {
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

        for (const [permissionName, { resourceId, policies: policySet }] of Object.entries(permissionPolicyMap)) {
            const policyIds = Array.from(policySet);
            const existingPermission = existingPermissions.find(p => p.name === permissionName);

            if (existingPermission) {
                const currentPolicies = existingPermission.policies || [];
                const updatedPolicies = [...new Set([...currentPolicies, ...policyIds])];
                if (updatedPolicies.length !== currentPolicies.length) {
                    await axios.put(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/resource/${existingPermission.id}`,
                        {
                            name: permissionName,
                            description: `Permission for ${permissionName.replace('-permission', '')}`,
                            type: 'resource',
                            resources: [resourceId],
                            policies: updatedPolicies,
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
                        description: `Permission for ${permissionName.replace('-permission', '')}`,
                        type: 'resource',
                        resources: [resourceId],
                        policies: policyIds,
                        decisionStrategy: 'AFFIRMATIVE',
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
        }
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        throw error;
    }
}

if (require.main === module) {
    migratePermissionsKeycloakAssignments().catch(console.error);
}

module.exports = { migratePermissionsKeycloakAssignments };