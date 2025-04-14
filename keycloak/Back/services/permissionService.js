const axios = require('axios');
const { Permission, Role, User, UserPermissionOverride } = require('../models');
const logger = require('../utils/logger');
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
                username: process.env.ADMIN_USER,
                password: process.env.ADMIN_PASS,
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
            logger.error(`Fetch permissions error: ${error.message}`, { ip: null });
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
            logger.error(`Get permission error: ${error.message}`, { ip: null });
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

            logger.info(`Permission ${permissionID} updated by user ${actorID}`, { ip: null });
            return permission;
        } catch (error) {
            logger.error(`Update permission error: ${error.message}, user: ${actorID}`, { ip: null });
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

            // Validate permissions
            const permissions = await Permission.findAll({
                where: { permissionID: permissionIDs },
            });
            if (permissions.length !== permissionIDs.length) throw new Error('One or more permissions not found.');

            // Check if user is Super Admin
            const isSuperAdmin = user.roles.includes('Super Admin');

            // Restrict non-Super Admins from assigning Role/Permission classes
            if (!isSuperAdmin) {
                const restrictedPermissions = permissions.filter((p) => ['Role', 'Permission'].includes(p.class));
                if (restrictedPermissions.length > 0) {
                    throw new Error('You do not have permission to assign Role or Permission class permissions.');
                }
            }

            // Get or create role policy in Keycloak
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
                } else {
                    throw new Error('Could not create policy.');
                }
            }

            // Fetch Keycloak resources and permissions
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

            // Process each permission
            for (const perm of permissions) {
                const resource = resources.find((r) => r.name === perm.name);
                if (!resource) continue;
                const resourceId = resource._id;

                const permissionName = `${perm.name}-permission`;
                const existingPermission = existingPermissions.find((p) => p.name === permissionName);

                if (existingPermission) {
                    const rolesWithPermission = await Role.findAll({
                        include: [
                            {
                                model: Permission,
                                where: { permissionID: perm.permissionID },
                                through: { attributes: [] },
                            },
                        ],
                    });

                    const policyIdsFromDB = rolesWithPermission
                        .map((r) => allPolicies.find((p) => p.name === `${r.name}-policy`)?.id)
                        .filter((id) => id);
                    policyIdsFromDB.push(policyId);

                    const updatedPolicies = [...new Set(policyIdsFromDB)];
                    const currentPolicies = Array.isArray(existingPermission.policies)
                        ? existingPermission.policies
                        : [];
                    const finalPolicies = [...new Set([...currentPolicies, ...updatedPolicies])];

                    await axios.put(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/${existingPermission.id}`,
                        {
                            name: permissionName,
                            description: existingPermission.description || `Permission for ${perm.name}`,
                            type: 'resource',
                            resources: [resourceId],
                            policies: finalPolicies,
                            decisionStrategy: 'AFFIRMATIVE',
                            logic: 'POSITIVE',
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } else {
                    await axios.post(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/resource`,
                        {
                            name: permissionName,
                            description: `Permission for ${perm.name}`,
                            type: 'resource',
                            resources: [resourceId],
                            policies: [policyId],
                            decisionStrategy: 'AFFIRMATIVE',
                            logic: 'POSITIVE',
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                }
            }

            // Update local DB
            const currentPermissions = await role.getPermissions();
            const currentPermissionIDs = currentPermissions.map((p) => p.permissionID);
            const newPermissions = permissions.filter((p) => !currentPermissionIDs.includes(p.permissionID));
            if (newPermissions.length > 0) {
                await role.addPermissions(newPermissions);
            }

            logger.info(`Assigned ${newPermissions.length} permissions to role ${roleID} by user ${actorID}`, { ip: null });
            return {
                roleID,
                assignedPermissions: newPermissions.map((p) => p.name),
                totalAssigned: (await role.getPermissions()).length,
            };
        } catch (error) {
            logger.error(`Assign permissions error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || 'Could not assign permissions.');
        }
    }

    static async revokePermissionsFromRole(roleID, permissionIDs, actorID) {
        try {
            const token = await getAdminToken();
            const clientUUID = await getClientUUID(token);

            const role = await Role.findByPk(roleID);
            if (!role) throw new Error('Role not found.');

            const results = [];
            for (const permissionID of permissionIDs) {
                const permission = await Permission.findByPk(permissionID);
                if (!permission) throw new Error('Permission not found.');

                // Update Keycloak
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
                        const currentPolicies = Array.isArray(existingPermission.policies)
                            ? existingPermission.policies
                            : [];
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
                }

                // Update local DB
                await role.removePermission(permission);

                results.push({
                    roleID,
                    revokedPermission: permission.name,
                    totalAssigned: (await role.getPermissions()).length,
                });
            }

            logger.info(`Revoked ${results.length} permissions from role ${roleID} by user ${actorID}`, { ip: null });
            return results.length === 1 ? results[0] : results;
        } catch (error) {
            logger.error(`Revoke permissions error: ${error.message}, user: ${actorID}`, { ip: null });
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
            logger.error(`Get role permissions error: ${error.message}`, { ip: null });
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
            const updatedUser = {
                ...keycloakUserResponse.data,
                attributes: {
                    ...currentAttributes,
                    permission_overrides: [JSON.stringify(overrides)],
                },
            };

            await axios.put(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}`,
                updatedUser,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            await transaction.commit();
            logger.info(`Permission override added for user ${userID} by ${actorID}`, { ip: null });
            return override;
        } catch (error) {
            await transaction.rollback();
            logger.error(`Add permission override error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || 'Could not add permission override.');
        }
    }

    static async removePermissionOverride(overrideID, actorID) {
        const transaction = await UserPermissionOverride.sequelize.transaction();
        try {
            const override = await UserPermissionOverride.findByPk(overrideID);
            if (!override) throw new Error('Override not found.');

            const token = await getAdminToken();

            // Fetch Keycloak user
            const keycloakUserResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${override.userID}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Parse existing attributes
            const currentAttributes = keycloakUserResponse.data.attributes || {};
            const overrides = JSON.parse(currentAttributes.permission_overrides?.[0] || '{}');
            const permission = await Permission.findByPk(override.permissionID);

            // Remove the override
            if (overrides[override.roleID]?.[permission.name]) {
                delete overrides[override.roleID][permission.name];
                if (Object.keys(overrides[override.roleID]).length === 0) {
                    delete overrides[override.roleID];
                }

                // Update Keycloak with merged attributes
                const updatedUser = {
                    ...keycloakUserResponse.data,
                    attributes: {
                        ...currentAttributes,
                        permission_overrides: [JSON.stringify(overrides)],
                    },
                };

                await axios.put(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${override.userID}`,
                    updatedUser,
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
            logger.info(`Permission override ${overrideID} removed by user ${actorID}`, { ip: null });
            return { message: 'Override removed successfully.' };
        } catch (error) {
            await transaction.rollback();
            logger.error(`Remove permission override error: ${error.message}, user: ${actorID}`, { ip: null });
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
            logger.error(`Get effective permissions error: ${error.message}`, { ip: null });
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
            logger.error(`Get permission overrides error: ${error.message}`, { ip: null });
            throw new Error(error.message || 'Could not fetch permission overrides.');
        }
    }
}

module.exports = PermissionService;