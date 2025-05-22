const axios = require('axios');
const { Permission, Role, User, sequelize } = require('../models');
require('dotenv').config();

// Keycloak configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';

// Helper functions from migration script
async function getAdminToken() {
    try {
        const response = await axios.post(
            `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: 'password',
                client_id: 'admin-cli',
                username: process.env.KEYCLOAK_ADMIN_USER,
                password: process.env.KEYCLOAK_ADMIN_PASSWORD,
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
        let allResources = [];
        let first = 0;
        const max = 100;
        let hasMore = true;

        while (hasMore) {
            const response = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { first, max },
                }
            );
            const resources = response.data;
            allResources = allResources.concat(resources);
            hasMore = resources.length === max;
            first += max;
        }

        return allResources;
    } catch (err) {
        throw new Error(`Failed to fetch resources: ${err.response?.data?.error_description || err.message}`);
    }
}

async function getExistingPolicies(token, clientUUID) {
    try {
        let allPolicies = [];
        let first = 0;
        const max = 100;
        let hasMore = true;

        while (hasMore) {
            const response = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { first, max },
                }
            );
            const policies = response.data;
            allPolicies = allPolicies.concat(policies);
            hasMore = policies.length === max;
            first += max;
        }

        return allPolicies.filter(policy => policy.type === 'role');
    } catch (err) {
        throw new Error(`Failed to fetch policies: ${err.response?.data?.error_description || err.message}`);
    }
}

async function getExistingPermissions(token, clientUUID) {
    try {
        let allPermissions = [];
        let first = 0;
        const max = 100;
        let hasMore = true;

        while (hasMore) {
            const response = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { first, max },
                }
            );
            const permissions = response.data;
            allPermissions = allPermissions.concat(permissions);
            hasMore = permissions.length === max;
            first += max;
        }

        return allPermissions;
    } catch (err) {
        throw new Error(`Failed to fetch permissions: ${err.response?.data?.error_description || err.message}`);
    }
}

class PermissionService {
    static async assignPermissionsToRole(user, roleID, permissionIDs, actorID) {
        try {
            const token = await getAdminToken();
            const clientUUID = await getClientUUID(token);

            // Validate role
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error('Role not found.');

            // Check if role exists in Keycloak
            const roleResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
                { headers: { Authorization: `Bearer ${token}` } }
            ).catch(() => null);
            if (!roleResponse) {
                await axios.post(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/roles`,
                    { name: role.name, description: role.description || '' },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }

            // Normalize permissionIDs
            let normalizedPermissionIDs = Array.isArray(permissionIDs)
                ? permissionIDs
                : typeof permissionIDs === 'string'
                    ? permissionIDs.split(',').map(id => id.trim()).filter(id => id)
                    : [];
            if (!normalizedPermissionIDs.length) {
                throw new Error('No valid permission IDs provided.');
            }

            // Validate permissions
            const permissions = await Permission.findAll({
                where: { permissionID: normalizedPermissionIDs },
            });
            if (permissions.length !== normalizedPermissionIDs.length) {
                throw new Error('One or more permissions not found.');
            }

            // Check if user is Super Admin
            const isSuperAdmin = user.roles.includes(process.env.ROLE_SUPER_ADMIN);
            if (!isSuperAdmin) {
                const restrictedPermissions = permissions.filter((p) => ['Role', 'Permission'].includes(p.class));
                if (restrictedPermissions.length > 0) {
                    throw new Error('You do not have permission to assign Role or Permission class permissions.');
                }
            }

            // Fetch existing Keycloak data
            const keycloakResources = await getExistingResources(token, clientUUID);
            const keycloakPolicies = await getExistingPolicies(token, clientUUID);
            const keycloakPermissions = await getExistingPermissions(token, clientUUID);

            // Get or create role policy
            let rolePolicyID;
            const policyName = `${role.name}-policy`;
            const rolePolicy = keycloakPolicies.find(p => p.name === policyName);
            if (rolePolicy) {
                rolePolicyID = rolePolicy.id;
            } else {
                const rolePolicyResponse = await axios.post(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role`,
                    {
                        name: policyName,
                        description: `Policy for ${role.name} role`,
                        roles: [{ id: role.name, required: true }],
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                rolePolicyID = rolePolicyResponse.data.id;
            }

            // Process each permission
            const assignedPermissions = [];
            for (const perm of permissions) {
                // Get or create resource
                let resource = keycloakResources.find(r => r.name === perm.name);
                if (!resource) {
                    const resourceResponse = await axios.post(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource`,
                        {
                            name: perm.name,
                            displayName: perm.description || perm.name,
                            type: perm.class,
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    resource = resourceResponse.data;
                }

                // Get or create permission
                const permissionName = `${perm.name}-permission`;
                let keycloakPermission = keycloakPermissions.find(p => p.name === permissionName);
                let permissionId;

                // Fetch all roles associated with this permission in the local DB
                const dbRolesResult = await sequelize.query(`
                SELECT r.name
                FROM "Roles" r
                JOIN "RolePermissions" rp ON r."roleID" = rp."roleID"
                WHERE rp."permissionID" = :permissionID
            `, {
                    replacements: { permissionID: perm.permissionID },
                    type: sequelize.QueryTypes.SELECT
                });

                // Ensure dbRolesResult is an array
                const dbRoles = Array.isArray(dbRolesResult) ? dbRolesResult : [];

                // Include the current role if it’s being assigned
                const roleNames = [...new Set([...dbRoles.map(r => r.name).filter(name => name), role.name])];

                const policyIds = roleNames
                    .map(rName => {
                        const policy = keycloakPolicies.find(p => p.name === `${rName}-policy`) ||
                            (rName === role.name ? { id: rolePolicyID } : null);
                        return policy ? policy.id : null;
                    })
                    .filter(id => id);

                if (keycloakPermission) {
                    permissionId = keycloakPermission.id;
                    // Update existing permission with all relevant policies
                    await axios.put(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/${permissionId}`,
                        {
                            name: permissionName,
                            description: `Permission for ${perm.name}`,
                            type: 'resource',
                            resources: [resource._id],
                            policies: policyIds,
                            decisionStrategy: 'AFFIRMATIVE',
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } else {
                    // Create new permission
                    const permissionResponse = await axios.post(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/resource`,
                        {
                            name: permissionName,
                            description: `Permission for ${perm.name}`,
                            type: 'resource',
                            resources: [resource._id],
                            policies: policyIds,
                            decisionStrategy: 'AFFIRMATIVE',
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    permissionId = permissionResponse.data.id;
                }

                assignedPermissions.push(perm.name);
            }

            // Update local DB
            const currentPermissions = await role.getPermissions();
            const currentPermissionIDs = currentPermissions.map(p => p.permissionID);
            const newPermissions = permissions.filter(p => !currentPermissionIDs.includes(p.permissionID));
            if (newPermissions.length > 0) {
                await role.addPermissions(newPermissions);
            }

            return {
                roleID,
                assignedPermissions,
                totalAssigned: (await role.getPermissions()).length,
            };
        } catch (error) {
            throw new Error(error.message || 'Could not assign permissions.');
        }
    }
    static async revokePermissionsFromRole(roleID, permissionIDs, actorID) {
        try {
            const token = await getAdminToken();
            const clientUUID = await getClientUUID(token);

            // Validate role
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error('Role not found.');

            // Fetch existing Keycloak data
            const keycloakResources = await getExistingResources(token, clientUUID);
            const keycloakPolicies = await getExistingPolicies(token, clientUUID);
            const keycloakPermissions = await getExistingPermissions(token, clientUUID);

            // Normalize permissionIDs
            let normalizedPermissionIDs = Array.isArray(permissionIDs)
                ? permissionIDs
                : typeof permissionIDs === 'string'
                    ? permissionIDs.split(',').map(id => id.trim()).filter(id => id)
                    : [];
            if (!normalizedPermissionIDs.length) {
                throw new Error('No valid permission IDs provided.');
            }

            // Validate permissions
            const permissions = await Permission.findAll({
                where: { permissionID: normalizedPermissionIDs },
            });
            if (permissions.length !== normalizedPermissionIDs.length) {
                throw new Error('One or more permissions not found.');
            }

            const results = [];
            for (const perm of permissions) {
                // Check if permission is assigned to role
                const hasPermission = await role.hasPermission(perm);
                if (!hasPermission) continue;

                // Get resource
                const resource = keycloakResources.find(r => r.name === perm.name);
                if (!resource) {
                    continue;
                }

                // Get permission
                const permissionName = `${perm.name}-permission`;
                const keycloakPermission = keycloakPermissions.find(p => p.name === permissionName);
                if (!keycloakPermission) {
                    continue;
                }

                // Fetch all roles associated with this permission in the local DB, excluding the current role
                const [dbRoles] = await sequelize.query(`
                    SELECT r.name
                    FROM "Roles" r
                    JOIN "RolePermissions" rp ON r."roleID" = rp."roleID"
                    WHERE rp."permissionID" = :permissionID AND r."roleID" != :roleID
                `, {
                    replacements: { permissionID: perm.permissionID, roleID },
                    type: sequelize.QueryTypes.SELECT
                });

                const roleNames = dbRoles.map(r => r.name);
                const policyIds = roleNames
                    .map(rName => {
                        const policy = keycloakPolicies.find(p => p.name === `${rName}-policy`);
                        return policy ? policy.id : null;
                    })
                    .filter(id => id);

                if (policyIds.length === 0) {
                    // No other roles use this permission, delete it
                    await axios.delete(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/${keycloakPermission.id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } else {
                    // Update permission with remaining policies
                    await axios.put(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/${keycloakPermission.id}`,
                        {
                            name: permissionName,
                            description: `Permission for ${perm.name}`,
                            type: 'resource',
                            resources: [resource._id],
                            policies: policyIds,
                            decisionStrategy: 'AFFIRMATIVE',
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                }

                // Update local DB
                await role.removePermission(perm);

                results.push({
                    roleID,
                    revokedPermission: perm.name,
                    totalAssigned: (await role.getPermissions()).length,
                });
            }

            return results.length === 1 ? results[0] : results;
        } catch (error) {
            throw new Error(error.message || 'Could not revoke permissions.');
        }
    }
    static async getAllPermissions() {
        try {
            const permissions = await Permission.findAll({
                attributes: ['permissionID', 'name', 'class', 'description'],
            });
            return permissions;
        } catch (error) {
            throw new Error('Could not fetch permissions.');
        }
    }

    static async getPermissionById(permissionID) {
        try {
            const permission = await Permission.findByPk(permissionID, {
                include: [{ model: Role, attributes: ['roleID', 'name'] }],
            });
            if (!permission) throw new Error('Permission not found.');
            return permission;
        } catch (error) {
            throw new Error(error.message || 'Could not fetch permission.');
        }
    }

    static async updatePermission(permissionID, updates, actorID) {
        try {
            const permission = await Permission.findByPk(permissionID);
            if (!permission) throw new Error('Permission not found.');

            const token = await getAdminToken();
            const clientUUID = await getClientUUID(token);

            // Update Keycloak resource
            const resourceResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource?name=${permission.name}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const resourceId = resourceResponse.data[0]?._id;
            if (!resourceId) throw new Error('Resource not found in Keycloak.');

            await axios.put(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource/${resourceId}`,
                {
                    name: permission.name,
                    displayName: updates.description || permission.description,
                    type: updates.className || permission.class,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Update local DB
            await permission.update({
                class: updates.className || permission.class,
                description: updates.description || permission.description,
            });

            return permission;
        } catch (error) {
            throw new Error(error.message || 'Could not update permission.');
        }
    }

    static async getPermissionsByRole(roleID) {
        try {
            const role = await Role.findByPk(roleID, {
                include: [
                    {
                        model: Permission,
                        through: { attributes: [] },
                        attributes: ['permissionID', 'name', 'class', 'description'],
                    },
                ],
            });
            if (!role) throw new Error('Role not found.');
            return role.Permissions;
        } catch (error) {
            throw new Error(error.message || 'Could not fetch role permissions.');
        }
    }


    static async getEffectivePermissions(userID) {
        try {
            const user = await User.findByPk(userID, {
                include: [
                    {
                        model: Role,
                        through: { attributes: [] },
                        include: [{ model: Permission, through: { attributes: [] } }],
                    },
                ],
            });
            if (!user) throw new Error('User not found.');

            const effectivePermissions = [];
            for (const role of user.Roles) {
                effectivePermissions.push(...role.Permissions);
            }
            return effectivePermissions;
        } catch (error) {
            throw new Error(error.message || 'Could not fetch effective permissions.');
        }
    }


}

module.exports = PermissionService;