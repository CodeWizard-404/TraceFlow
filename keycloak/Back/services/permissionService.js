const axios = require('axios');
const { Permission, Role, User, UserPermissionOverride } = require('../models');
require('dotenv').config();

// Keycloak configuration from environment variables
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';

// Get an admin token to interact with Keycloak
async function getAdminToken() {
    const response = await axios.post(
        `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
        new URLSearchParams({
            grant_type: 'password',
            client_id: 'admin-cli',
            username: process.env.ADMIN_USER,
            password: process.env.ADMIN_PASS,
        })
    );
    return response.data.access_token;
}

// Get the UUID of our client in Keycloak
async function getClientUUID(token) {
    const response = await axios.get(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const client = response.data.find(c => c.clientId === CLIENT_ID);
    if (!client) throw new Error(`Client ${CLIENT_ID} not found`);
    return client.id;
}

class PermissionService {
    // Create a new permission in both local DB and Keycloak
    static async createPermission(name, className, description) {
        const token = await getAdminToken(); // Get admin token for Keycloak
        const clientUUID = await getClientUUID(token); // Get client UUID

        // Step 1: Create the resource in Keycloak
        const resourceResponse = await axios.post(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource`,
            { name, displayName: description, type: className },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`Created resource ${name} in Keycloak`);

        // Step 2: Save the permission in the local database
        const permission = await Permission.create({ name, class: className, description });
        console.log(`Created permission ${name} in local DB`);

        return permission; // Return the created permission object
    }

    // Get all permissions from the local database
    static async getAllPermissions() {
        return await Permission.findAll({
            attributes: ['permissionID', 'name', 'class', 'description'] // Only return needed fields
        });
    }

    // Get a specific permission by its ID, including associated roles
    static async getPermissionById(permissionID) {
        const permission = await Permission.findByPk(permissionID, {
            include: [{ model: Role, attributes: ['roleID', 'name'] }], // Include roles linked to this permission
        });
        if (!permission) throw new Error('Permission not found');
        return permission;
    }

    // Update a permission’s details in both local DB and Keycloak
    static async updatePermission(permissionID, updates) {
        const permission = await Permission.findByPk(permissionID);
        if (!permission) throw new Error('Permission not found');

        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);

        // Step 1: Find the resource in Keycloak by name
        const resourceResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource?name=${permission.name}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const resourceId = resourceResponse.data[0]?._id;
        if (!resourceId) throw new Error(`Resource ${permission.name} not found in Keycloak`);

        // Step 2: Update the resource in Keycloak with new values (or keep old ones if not provided)
        await axios.put(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource/${resourceId}`,
            {
                name: updates.name || permission.name,
                displayName: updates.description || permission.description,
                type: updates.className || permission.class,
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`Updated resource ${permission.name} in Keycloak`);

        // Step 3: Update the permission in the local database
        await permission.update({
            name: updates.name || permission.name,
            class: updates.className || permission.class,
            description: updates.description || permission.description,
        });
        console.log(`Updated permission ${permission.name} in local DB`);

        return permission;
    }

    // Delete a permission from both local DB and Keycloak
    static async deletePermission(permissionID) {
        const permission = await Permission.findByPk(permissionID);
        if (!permission) throw new Error('Permission not found');

        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);

        // Step 1: Find and delete the resource in Keycloak
        const resourceResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource?name=${permission.name}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const resourceId = resourceResponse.data[0]?._id;
        if (resourceId) {
            await axios.delete(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource/${resourceId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log(`Deleted resource ${permission.name} from Keycloak`);
        }

        // Step 2: Delete the permission from the local database
        await permission.destroy();
        console.log(`Deleted permission ${permission.name} from local DB`);

        return { message: `Permission ${permissionID} deleted successfully` };
    }

    // Assign permissions to a role, syncing both local DB and Keycloak
    static async assignPermissionsToRole(roleID, permissionIDs) {
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);

        // Step 1: Validate the role exists
        const role = await Role.findByPk(roleID);
        if (!role) throw new Error('Role not found');

        // Step 2: Validate all permissions exist
        const permissions = await Permission.findAll({ where: { permissionID: permissionIDs } });
        if (permissions.length !== permissionIDs.length) throw new Error('One or more permissions not found');

        // Step 3: Fetch or create the role’s policy in Keycloak
        let policyId;
        const policyName = `${role.name}-policy`;
        try {
            const rolePolicyResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role?name=${policyName}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            policyId = rolePolicyResponse.data[0]?.id;
        } catch (error) {
            if (error.response?.status === 404 || !policyId) {
                const keycloakRole = await axios.get(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const roleId = keycloakRole.data.id;

                const policyResponse = await axios.post(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role`,
                    {
                        name: policyName,
                        description: `Policy for ${role.name} role`,
                        logic: 'POSITIVE',
                        type: 'role',
                        roles: [{ id: roleId, required: true }],
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                policyId = policyResponse.data.id;
                console.log(`Created policy ${policyName} for role ${role.name}`);
            } else {
                throw new Error(`Failed to fetch/create policy: ${error.message}`);
            }
        }

        // Step 4: Fetch Keycloak resources and permissions
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

        const allPoliciesResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const allPolicies = allPoliciesResponse.data;

        // Step 5: Process each permission
        for (const perm of permissions) {
            const resource = resources.find(r => r.name === perm.name);
            if (!resource) {
                console.log(`Resource ${perm.name} not found in Keycloak, skipping`);
                continue;
            }
            const resourceId = resource._id;

            const permissionName = `${perm.name}-permission`;
            const existingPermission = existingPermissions.find(p => p.name === permissionName);

            if (existingPermission) {
                // Get all roles that have this permission in the local DB
                const rolesWithPermission = await Role.findAll({
                    include: [{
                        model: Permission,
                        where: { permissionID: perm.permissionID },
                        through: { attributes: [] },
                    }],
                });

                // Build a list of policy IDs from these roles
                const policyIdsFromDB = rolesWithPermission
                    .map(r => allPolicies.find(p => p.name === `${r.name}-policy`)?.id)
                    .filter(id => id); // Remove undefined/null

                // Add the new policyId for this role
                policyIdsFromDB.push(policyId);

                // Remove duplicates
                const updatedPolicies = [...new Set(policyIdsFromDB)];
                console.log(`Policies for ${permissionName} from DB: ${updatedPolicies.map(id => allPolicies.find(p => p.id === id)?.name || id).join(', ')}`);

                // Merge with any existing Keycloak policies
                const currentPolicies = Array.isArray(existingPermission.policies) ? existingPermission.policies : [];
                const finalPolicies = [...new Set([...currentPolicies, ...updatedPolicies])];

                // Update the permission in Keycloak
                await axios.put(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/${existingPermission.id}`,
                    {
                        name: permissionName,
                        description: existingPermission.description || `Permission for ${perm.name}`,
                        type: 'resource',
                        resources: [resourceId],
                        policies: finalPolicies,
                        decisionStrategy: 'UNANIMOUS',
                        logic: 'POSITIVE',
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log(`Updated ${permissionName} with policies: ${finalPolicies.map(id => allPolicies.find(p => p.id === id)?.name || id).join(', ')}`);
            } else {
                // Create a new permission in Keycloak if it doesn’t exist
                await axios.post(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/resource`,
                    {
                        name: permissionName,
                        description: `Permission for ${perm.name}`,
                        type: 'resource',
                        resources: [resourceId],
                        policies: [policyId],
                        decisionStrategy: 'UNANIMOUS',
                        logic: 'POSITIVE',
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log(`Created ${permissionName} with policy: ${policyId}`);
            }
        }

        // Step 6: Update local DB with role-permission associations
        const currentPermissions = await role.getPermissions();
        const currentPermissionIDs = currentPermissions.map(p => p.permissionID);
        const newPermissions = permissions.filter(p => !currentPermissionIDs.includes(p.permissionID));
        if (newPermissions.length > 0) {
            await role.addPermissions(newPermissions);
            console.log(`Assigned ${newPermissions.length} permissions to role ${role.name} in local DB`);
        }

        return {
            roleID,
            assignedPermissions: newPermissions.map(p => p.name),
            totalAssigned: (await role.getPermissions()).length,
        };
    }

    // Revoke permissions from a role in both local DB and Keycloak
    static async revokePermissionsFromRole(roleID, permissionIDs) {
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);

        const role = await Role.findByPk(roleID);
        if (!role) throw new Error('Role not found');

        const results = [];
        for (const permissionID of permissionIDs) {
            const permission = await Permission.findByPk(permissionID);
            if (!permission) throw new Error(`Permission not found: ${permissionID}`);

            // Step 1: Remove the role’s policy from the permission in Keycloak
            const permissionName = `${permission.name}-permission`;
            const permissionResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission?name=${permissionName}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (permissionResponse.data.length) {
                const existingPermission = permissionResponse.data[0];
                const policyName = `${role.name}-policy`;
                const policyResponse = await axios.get(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role?name=${policyName}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const policyId = policyResponse.data[0]?.id;

                if (policyId) {
                    const currentPolicies = Array.isArray(existingPermission.policies) ? existingPermission.policies : [];
                    const updatedPolicies = currentPolicies.filter(id => id !== policyId);

                    if (updatedPolicies.length === 0) {
                        // If no policies remain, delete the permission
                        await axios.delete(
                            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/${existingPermission.id}`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        console.log(`Deleted ${permissionName} from Keycloak (no policies left)`);
                    } else {
                        // Update the permission with remaining policies
                        await axios.put(
                            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/${existingPermission.id}`,
                            {
                                ...existingPermission,
                                policies: updatedPolicies,
                            },
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        console.log(`Updated ${permissionName} in Keycloak, removed policy ${policyId}`);
                    }
                }
            }

            // Step 2: Remove the association in the local DB
            await role.removePermission(permission);
            console.log(`Revoked permission ${permission.name} from role ${role.name} in local DB`);

            results.push({
                roleID,
                revokedPermission: permission.name,
                totalAssigned: (await role.getPermissions()).length,
            });
        }

        return results.length === 1 ? results[0] : results;
    }

    // Get all permissions assigned to a role from the local DB
    static async getPermissionsByRole(roleID) {
        const role = await Role.findByPk(roleID, {
            include: [{ model: Permission, through: { attributes: [] }, attributes: ['permissionID', 'name', 'class', 'description'] }],
        });
        if (!role) throw new Error('Role not found');
        return role.Permissions;
    }

    // Add a permission override for a user (grant or revoke)
    static async addPermissionOverride(userID, roleID, permissionID, action) {
        const token = await getAdminToken();

        // Step 1: Validate user, role, and permission
        const user = await User.findByPk(userID);
        if (!user) throw new Error('User not found');
        const role = await Role.findByPk(roleID);
        if (!role) throw new Error('Role not found');
        const permission = await Permission.findByPk(permissionID);
        if (!permission) throw new Error('Permission not found');

        // Step 2: Check if user has the role
        const userRoles = await user.getRoles({ where: { roleID } });
        if (!userRoles.length) throw new Error('User does not have this role');

        // Step 3: Create or update the override in the local DB
        const [override, created] = await UserPermissionOverride.findOrCreate({
            where: { userID, roleID, permissionID },
            defaults: { action },
        });
        if (!created) await override.update({ action });
        console.log(`Added/updated override for user ${userID} on permission ${permission.name}`);

        // Step 4: Update Keycloak user attributes
        const keycloakUser = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const overrides = JSON.parse(keycloakUser.data.attributes?.permission_overrides || '{}');
        overrides[roleID] = overrides[roleID] || {};
        overrides[roleID][permission.name] = action;

        await axios.put(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}`,
            { attributes: { permission_overrides: JSON.stringify(overrides) } },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`Updated Keycloak user ${userID} with permission override`);

        return override;
    }

    // Remove a permission override
    static async removePermissionOverride(overrideID) {
        const override = await UserPermissionOverride.findByPk(overrideID);
        if (!override) throw new Error('Override not found');

        const token = await getAdminToken();

        // Step 1: Update Keycloak user attributes
        const keycloakUser = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${override.userID}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const overrides = JSON.parse(keycloakUser.data.attributes?.permission_overrides || '{}');
        const permission = await Permission.findByPk(override.permissionID);

        if (overrides[override.roleID] && overrides[override.roleID][permission.name]) {
            delete overrides[override.roleID][permission.name];
            if (Object.keys(overrides[override.roleID]).length === 0) delete overrides[override.roleID];

            await axios.put(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${override.userID}`,
                { attributes: { permission_overrides: JSON.stringify(overrides) } },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log(`Removed override from Keycloak for user ${override.userID}`);
        }

        // Step 2: Delete the override from the local DB
        await override.destroy();
        console.log(`Deleted override ${overrideID} from local DB`);

        return { message: 'Override removed successfully' };
    }

    // Get a user’s effective permissions, considering overrides
    static async getEffectivePermissions(userID) {
        const user = await User.findByPk(userID, {
            include: [
                { model: Role, through: { attributes: [] }, include: [{ model: Permission, through: { attributes: [] } }] },
                { model: UserPermissionOverride, include: [{ model: Permission }] },
            ],
        });
        if (!user) throw new Error('User not found');

        // Step 1: Build a map of permissions by role
        const rolePermissions = {};
        for (const role of user.Roles) {
            rolePermissions[role.roleID] = role.Permissions.reduce((acc, perm) => {
                acc[perm.permissionID] = perm;
                return acc;
            }, {});
        }

        // Step 2: Apply overrides (grant or revoke permissions)
        for (const override of user.UserPermissionOverrides) {
            const { roleID, permissionID, action } = override;
            if (!rolePermissions[roleID]) continue;
            if (action === 'revoke') delete rolePermissions[roleID][permissionID];
            else if (action === 'grant') rolePermissions[roleID][permissionID] = override.Permission;
        }

        // Step 3: Flatten the permissions into a single list
        const effectivePermissions = [];
        for (const roleID in rolePermissions) {
            effectivePermissions.push(...Object.values(rolePermissions[roleID]));
        }
        return effectivePermissions;
    }

    // Get all permission overrides for a user
    static async getPermissionOverrides(userID) {
        const user = await User.findByPk(userID, {
            include: [{ model: UserPermissionOverride, include: [{ model: Permission }] }],
        });
        if (!user) throw new Error('User not found');
        return user.UserPermissionOverrides;
    }
}

module.exports = PermissionService;