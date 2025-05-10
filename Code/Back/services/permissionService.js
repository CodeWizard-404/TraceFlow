const axios = require('axios');
const { Permission, Role, User, UserPermissionOverride } = require('../models');
require('dotenv').config();

// Keycloak configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';

// Get admin token for Keycloak
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
    } catch (error) {
        throw new Error('Could not authenticate with Keycloak.');
    }
}

// Get client UUID from Keycloak
async function getClientUUID(token) {
    try {
        const response = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const client = response.data.find((c) => c.clientId === CLIENT_ID);
        if (!client) throw new Error('Client not found.');
        return client.id;
    } catch (error) {
        throw new Error('Could not find client in Keycloak.');
    }
}

class PermissionService {
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

            // Check permissions in Keycloak
            for (const perm of permissions) {
                const resourceResponse = await axios.get(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource?name=${perm.name}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                ).catch(() => null);
                if (!resourceResponse?.data[0]) {
                    await axios.post(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource`,
                        {
                            name: perm.name,
                            displayName: perm.description || perm.name,
                            type: perm.class,
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                }
            }

            // Check if user is Super Admin
            const isSuperAdmin = user.roles.includes('Super Admin');
            if (!isSuperAdmin) {
                const restrictedPermissions = permissions.filter((p) => ['Role', 'Permission'].includes(p.class));
                if (restrictedPermissions.length > 0) {
                    throw new Error('You do not have permission to assign Role or Permission class permissions.');
                }
            }

            // Get or create role policy
            let rolePolicyID;
            const rolePolicyResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role?name=${role.name}-policy`,
                { headers: { Authorization: `Bearer ${token}` } }
            ).catch(() => null);
            if (rolePolicyResponse?.data[0]?.id) {
                rolePolicyID = rolePolicyResponse.data[0].id;
            } else {
                const rolePolicy = await axios.post(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role`,
                    { name: `${role.name}-policy`, description: `Policy for ${role.name} role`, roles: [{ id: role.name, required: true }] },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                rolePolicyID = rolePolicy.data.id;
            }

            // Process each permission
            for (const perm of permissions) {
                // Get or create permission resource
                const resourceResponse = await axios.get(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource?name=${perm.name}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const resourceId = resourceResponse.data[0]?._id;
                if (!resourceId) throw new Error(`Resource not found for permission ${perm.name}`);

                // Create or update permission in Keycloak
                let permissionId;
                const permissionResponse = await axios.get(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission?name=${perm.name}-permission`,
                    { headers: { Authorization: `Bearer ${token}` } }
                ).catch(() => null);
                if (permissionResponse?.data[0]?.id) {
                    permissionId = permissionResponse.data[0].id;
                    // Update existing permission
                    await axios.put(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/${permissionId}`,
                        {
                            name: `${perm.name}-permission`,
                            description: `Permission for ${perm.name}`,
                            type: 'resource',
                            resources: [resourceId],
                            policies: [rolePolicyID],
                            decisionStrategy: 'AFFIRMATIVE',
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } else {
                    // Create new permission
                    const permissionCreate = await axios.post(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/resource`,
                        {
                            name: `${perm.name}-permission`,
                            description: `Permission for ${perm.name}`,
                            type: 'resource',
                            resources: [resourceId],
                            policies: [rolePolicyID],
                            decisionStrategy: 'AFFIRMATIVE',
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    permissionId = permissionCreate.data.id;
                }
            }

            // Update local DB
            const currentPermissions = await role.getPermissions();
            const currentPermissionIDs = currentPermissions.map((p) => p.permissionID);
            const newPermissions = permissions.filter((p) => !currentPermissionIDs.includes(p.permissionID));
            if (newPermissions.length > 0) {
                await role.addPermissions(newPermissions);
            }

            return {
                roleID,
                assignedPermissions: newPermissions.map((p) => p.name),
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

            const role = await Role.findByPk(roleID);
            if (!role) throw new Error('Role not found.');

            // Get role policy
            const policyName = `${role.name}-policy`;
            const policyResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role?name=${policyName}`,
                { headers: { Authorization: `Bearer ${token}` } }
            ).catch(() => null);
            const policyId = policyResponse?.data[0]?.id;
            if (!policyId) throw new Error('Role policy not found in Keycloak.');

            const results = [];
            for (const permissionID of permissionIDs) {
                const permission = await Permission.findByPk(permissionID);
                if (!permission) continue;

                // Check if permission is assigned to role
                const hasPermission = await role.hasPermission(permission);
                if (!hasPermission) continue;

                // Update Keycloak permission
                const permissionName = `${permission.name}-permission`;
                const permissionResponse = await axios.get(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission?name=${permissionName}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                ).catch(() => null);

                if (permissionResponse?.data[0]) {
                    const existingPermission = permissionResponse.data[0];
                    const currentPolicies = Array.isArray(existingPermission.policies) ? existingPermission.policies : [];
                    const updatedPolicies = currentPolicies.filter((id) => id !== policyId);

                    if (updatedPolicies.length === 0) {
                        await axios.delete(
                            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/${existingPermission.id}`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                    } else {
                        await axios.put(
                            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/${existingPermission.id}`,
                            {
                                ...existingPermission,
                                policies: updatedPolicies,
                            },
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                    }
                }

                // Update local DB
                await role.removePermission(permission);

                results.push({
                    roleID,
                    revokedPermission: permission.name,
                    totalAssigned: (await role.getPermissions()).length,
                });
            }

            return results.length === 1 ? results[0] : results;
        } catch (error) {
            throw new Error(error.message || 'Could not revoke permissions.');
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

    static async addPermissionOverride(user, userID, roleID, permissionID, action, actorID) {
        const transaction = await UserPermissionOverride.sequelize.transaction();
        try {
            // Validate inputs
            const targetUser = await User.findByPk(userID);
            if (!targetUser) throw new Error('User not found.');
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error('Role not found.');
            const permission = await Permission.findByPk(permissionID);
            if (!permission) throw new Error('Permission not found.');

            // Check if user has the role
            const userRoles = await targetUser.getRoles({ where: { roleID } });
            if (!userRoles.length) throw new Error('User does not have this role.');

            // Check if user is Super Admin
            const isSuperAdmin = user.roles.includes('Super Admin');
            if (!isSuperAdmin && ['Role', 'Permission'].includes(permission.class)) {
                throw new Error('You do not have permission to assign Role or Permission class permissions.');
            }

            // Update local DB
            const [override, created] = await UserPermissionOverride.findOrCreate({
                where: { userID, roleID, permissionID },
                defaults: { action },
                transaction,
            });
            if (!created) await override.update({ action }, { transaction });

            // Update Keycloak
            const token = await getAdminToken();
            const keycloakUserResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Merge existing attributes
            const currentAttributes = keycloakUserResponse.data.attributes || {};
            const overrides = JSON.parse(currentAttributes.permission_overrides?.[0] || '{}');
            overrides[roleID] = overrides[roleID] || {};
            overrides[roleID][permission.name] = action;

            // Update user with merged attributes
            await axios.put(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}`,
                {
                    ...keycloakUserResponse.data,
                    attributes: {
                        ...currentAttributes,
                        permission_overrides: [JSON.stringify(overrides)],
                    },
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            await transaction.commit();
            return override;
        } catch (error) {
            await transaction.rollback();
            throw new Error(error.message || 'Could not add permission override.');
        }
    }

    static async removePermissionOverride(overrideID, actorID) {
        const transaction = await UserPermissionOverride.sequelize.transaction();
        try {
            const override = await UserPermissionOverride.findByPk(overrideID);
            if (!override) throw new Error('Override not found.');

            const token = await getAdminToken();
            const permission = await Permission.findByPk(override.permissionID);
            if (!permission) throw new Error('Permission not found.');

            // Fetch Keycloak user
            const keycloakUserResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${override.userID}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Parse and update attributes
            const currentAttributes = keycloakUserResponse.data.attributes || {};
            const overrides = JSON.parse(currentAttributes.permission_overrides?.[0] || '{}');

            if (overrides[override.roleID]?.[permission.name]) {
                delete overrides[override.roleID][permission.name];
                if (Object.keys(overrides[override.roleID]).length === 0) {
                    delete overrides[override.roleID];
                }

                await axios.put(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${override.userID}`,
                    {
                        ...keycloakUserResponse.data,
                        attributes: {
                            ...currentAttributes,
                            permission_overrides: [JSON.stringify(overrides)],
                        },
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    }
                );
            }

            // Delete from local DB
            await override.destroy({ transaction });

            await transaction.commit();
            return { message: 'Override removed successfully.' };
        } catch (error) {
            await transaction.rollback();
            throw new Error(error.message || 'Could not remove override.');
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
                    { model: UserPermissionOverride, include: [{ model: Permission }] },
                ],
            });
            if (!user) throw new Error('User not found.');

            const rolePermissions = {};
            for (const role of user.Roles) {
                rolePermissions[role.roleID] = role.Permissions.reduce((acc, perm) => {
                    acc[perm.permissionID] = perm;
                    return acc;
                }, {});
            }

            for (const override of user.UserPermissionOverrides) {
                const { roleID, permissionID, action } = override;
                if (!rolePermissions[roleID]) continue;
                if (action === 'revoke') {
                    delete rolePermissions[roleID][permissionID];
                } else if (action === 'grant') {
                    rolePermissions[roleID][permissionID] = override.Permission;
                }
            }

            const effectivePermissions = [];
            for (const roleID in rolePermissions) {
                effectivePermissions.push(...Object.values(rolePermissions[roleID]));
            }
            return effectivePermissions;
        } catch (error) {
            throw new Error(error.message || 'Could not fetch effective permissions.');
        }
    }

    static async getPermissionOverrides(userID) {
        try {
            const user = await User.findByPk(userID, {
                include: [{ model: UserPermissionOverride, include: [{ model: Permission }] }],
            });
            if (!user) throw new Error('User not found.');
            return user.UserPermissionOverrides;
        } catch (error) {
            throw new Error(error.message || 'Could not fetch permission overrides.');
        }
    }
}

module.exports = PermissionService;