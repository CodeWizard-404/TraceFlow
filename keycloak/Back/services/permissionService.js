const axios = require("axios");
const { Permission, Role, User, UserPermissionOverride } = require("../models");
require("dotenv").config();

// Keycloak configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || "http://localhost:8080";
const REALM = process.env.REALM || "TraceFlow";
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || "traceflow-backend";

// Get admin token for Keycloak
async function getAdminToken() {
    try {
        const response = await axios.post(
            `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: "password",
                client_id: "admin-cli",
                username: process.env.ADMIN_USER,
                password: process.env.ADMIN_PASS,
            })
        );
        return response.data.access_token;
    } catch (error) {
        throw new Error("Could not authenticate with Keycloak.");
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
        if (!client) throw new Error("Client not found.");
        return client.id;
    } catch (error) {
        throw new Error("Could not find client in Keycloak.");
    }
}

class PermissionService {
    // Get all permissions
    static async getAllPermissions() {
        try {
            return await Permission.findAll({
                attributes: ["permissionID", "name", "class", "description"],
            });
        } catch (error) {
            throw new Error("Could not fetch permissions.");
        }
    }

    // Get permission by ID
    static async getPermissionById(permissionID) {
        try {
            const permission = await Permission.findByPk(permissionID, {
                include: [{ model: Role, attributes: ["roleID", "name"] }],
            });
            if (!permission) throw new Error("Permission not found.");
            return permission;
        } catch (error) {
            throw new Error(error.message || "Could not fetch permission.");
        }
    }

    // Update permission details
    static async updatePermission(permissionID, updates) {
        try {
            const permission = await Permission.findByPk(permissionID);
            if (!permission) throw new Error("Permission not found.");

            const token = await getAdminToken();
            const clientUUID = await getClientUUID(token);

            // Update Keycloak resource
            const resourceResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource?name=${permission.name}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const resourceId = resourceResponse.data[0]?._id;
            if (!resourceId) throw new Error("Resource not found in Keycloak.");

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
            throw new Error(error.message || "Could not update permission.");
        }
    }

    // Assign permissions to a role
    static async assignPermissionsToRole(user, roleID, permissionIDs) {
        try {
            const token = await getAdminToken();
            const clientUUID = await getClientUUID(token);

            // Validate role
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error("Role not found.");

            // Validate permissions
            const permissions = await Permission.findAll({
                where: { permissionID: permissionIDs },
            });
            if (permissions.length !== permissionIDs.length)
                throw new Error("One or more permissions not found.");

            // Check if user is Super Admin
            const isSuperAdmin = user.Roles.some(
                (r) => r.name === "Super Admin"
            );

            // Restrict non-Super Admins from assigning Role/Permission classes
            if (!isSuperAdmin) {
                const restrictedPermissions = permissions.filter((p) =>
                    ["Role", "Permission"].includes(p.class)
                );
                if (restrictedPermissions.length > 0) {
                    throw new Error(
                        "You do not have permission to assign Role or Permission class permissions."
                    );
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
                            logic: "POSITIVE",
                            type: "role",
                            roles: [{ id: roleId, required: true }],
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    policyId = policyResponse.data.id;
                } else {
                    throw new Error("Could not create policy.");
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
                const existingPermission = existingPermissions.find(
                    (p) => p.name === permissionName
                );

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
                        .map(
                            (r) => allPolicies.find((p) => p.name === `${r.name}-policy`)?.id
                        )
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
                            type: "resource",
                            resources: [resourceId],
                            policies: finalPolicies,
                            decisionStrategy: "AFFIRMATIVE",
                            logic: "POSITIVE",
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } else {
                    await axios.post(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/resource`,
                        {
                            name: permissionName,
                            description: `Permission for ${perm.name}`,
                            type: "resource",
                            resources: [resourceId],
                            policies: [policyId],
                            decisionStrategy: "AFFIRMATIVE",
                            logic: "POSITIVE",
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                }
            }

            // Update local DB
            const currentPermissions = await role.getPermissions();
            const currentPermissionIDs = currentPermissions.map((p) => p.permissionID);
            const newPermissions = permissions.filter(
                (p) => !currentPermissionIDs.includes(p.permissionID)
            );
            if (newPermissions.length > 0) {
                await role.addPermissions(newPermissions);
            }

            return {
                roleID,
                assignedPermissions: newPermissions.map((p) => p.name),
                totalAssigned: (await role.getPermissions()).length,
            };
        } catch (error) {
            throw new Error(error.message || "Could not assign permissions.");
        }
    }

    // Revoke permissions from a role
    static async revokePermissionsFromRole(roleID, permissionIDs) {
        try {
            const token = await getAdminToken();
            const clientUUID = await getClientUUID(token);

            const role = await Role.findByPk(roleID);
            if (!role) throw new Error("Role not found.");

            const results = [];
            for (const permissionID of permissionIDs) {
                const permission = await Permission.findByPk(permissionID);
                if (!permission) throw new Error("Permission not found.");

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

            return results.length === 1 ? results[0] : results;
        } catch (error) {
            throw new Error(error.message || "Could not revoke permissions.");
        }
    }

    // Get permissions for a role
    static async getPermissionsByRole(roleID) {
        try {
            const role = await Role.findByPk(roleID, {
                include: [
                    {
                        model: Permission,
                        through: { attributes: [] },
                        attributes: ["permissionID", "name", "class", "description"],
                    },
                ],
            });
            if (!role) throw new Error("Role not found.");
            return role.Permissions;
        } catch (error) {
            throw new Error(error.message || "Could not fetch role permissions.");
        }
    }

    // Add permission override for a user
    static async addPermissionOverride(user, userID, roleID, permissionID, action) {
        const transaction = await UserPermissionOverride.sequelize.transaction();
        try {
            console.log("addPermissionOverride - Input user:", user);

            const token = await getAdminToken();

            // Validate inputs
            const targetUser = await User.findByPk(userID);
            if (!targetUser) throw new Error("User not found.");
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error("Role not found.");
            const permission = await Permission.findByPk(permissionID);
            if (!permission) throw new Error("Permission not found.");

            // Check if user has the role
            const userRoles = await targetUser.getRoles({ where: { roleID } });
            if (!userRoles.length) throw new Error("User does not have this role.");

            // Check if user is Super Admin
            const isSuperAdmin = Array.isArray(user?.roles) && user.roles.includes("Super Admin");
            console.log("addPermissionOverride - isSuperAdmin:", isSuperAdmin);

            if (!isSuperAdmin && ["Role", "Permission"].includes(permission.class)) {
                throw new Error(
                    "You do not have permission to assign Role or Permission class permissions."
                );
            }

            // Update local DB
            console.log("addPermissionOverride - Updating local DB...");
            const [override, created] = await UserPermissionOverride.findOrCreate({
                where: { userID, roleID, permissionID },
                defaults: { action },
                transaction
            });
            if (!created) await override.update({ action }, { transaction });
            console.log("addPermissionOverride - Local DB updated:", override);

            // Update Keycloak
            console.log("addPermissionOverride - Fetching Keycloak user...");
            const keycloakUserResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log("addPermissionOverride - Keycloak user:", keycloakUserResponse.data);

            // Merge existing attributes
            const currentAttributes = keycloakUserResponse.data.attributes || {};
            const overrides = JSON.parse(currentAttributes.permission_overrides?.[0] || "{}");
            overrides[roleID] = overrides[roleID] || {};
            overrides[roleID][permission.name] = action;
            console.log("addPermissionOverride - New overrides:", overrides);

            // Update user with merged attributes
            const updatedUser = {
                ...keycloakUserResponse.data,
                attributes: {
                    ...currentAttributes,
                    permission_overrides: [JSON.stringify(overrides)]
                }
            };

            console.log("addPermissionOverride - Sending Keycloak update:", updatedUser);
            try {
                await axios.put(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}`,
                    updatedUser,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                console.log("addPermissionOverride - Keycloak updated successfully");
            } catch (keycloakError) {
                console.error(
                    "addPermissionOverride - Keycloak update failed:",
                    keycloakError.response?.data || keycloakError.message
                );
                throw new Error("Failed to update Keycloak user attributes.");
            }

            await transaction.commit();
            return override;
        } catch (error) {
            await transaction.rollback();
            console.error(
                "addPermissionOverride - Error:",
                error.response?.data || error.message,
                error.stack
            );
            throw new Error(error.message || "Could not add permission override.");
        }
    }

    // Remove permission override
    static async removePermissionOverride(overrideID) {
        const transaction = await UserPermissionOverride.sequelize.transaction();
        try {
            console.log("removePermissionOverride - Override ID:", overrideID);

            const override = await UserPermissionOverride.findByPk(overrideID);
            if (!override) throw new Error("Override not found.");

            const token = await getAdminToken();

            // Fetch Keycloak user
            console.log("removePermissionOverride - Fetching Keycloak user...");
            const keycloakUserResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${override.userID}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log("removePermissionOverride - Keycloak user:", keycloakUserResponse.data);

            // Parse existing attributes
            const currentAttributes = keycloakUserResponse.data.attributes || {};
            const overrides = JSON.parse(currentAttributes.permission_overrides?.[0] || "{}");
            const permission = await Permission.findByPk(override.permissionID);

            // Remove the override
            if (overrides[override.roleID]?.[permission.name]) {
                console.log(
                    "removePermissionOverride - Removing override for:",
                    override.roleID,
                    permission.name
                );
                delete overrides[override.roleID][permission.name];
                if (Object.keys(overrides[override.roleID]).length === 0) {
                    delete overrides[override.roleID];
                }

                // Update Keycloak with merged attributes
                const updatedUser = {
                    ...keycloakUserResponse.data,
                    attributes: {
                        ...currentAttributes,
                        permission_overrides: [JSON.stringify(overrides)]
                    }
                };

                console.log("removePermissionOverride - Sending Keycloak update:", updatedUser);
                await axios.put(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${override.userID}`,
                    updatedUser,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                console.log("removePermissionOverride - Keycloak updated successfully");
            } else {
                console.log("removePermissionOverride - No matching override found in Keycloak");
            }

            // Delete from local DB
            console.log("removePermissionOverride - Deleting from local DB...");
            await override.destroy({ transaction });
            console.log("removePermissionOverride - Local DB updated");

            await transaction.commit();
            return { message: "Override removed successfully." };
        } catch (error) {
            await transaction.rollback();
            console.error(
                "removePermissionOverride - Error:",
                error.response?.data || error.message,
                error.stack
            );
            throw new Error(error.message || "Could not remove override.");
        }
    }

    // Get effective permissions for a user
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
            if (!user) throw new Error("User not found.");

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
                if (action === "revoke") {
                    delete rolePermissions[roleID][permissionID];
                } else if (action === "grant") {
                    rolePermissions[roleID][permissionID] = override.Permission;
                }
            }

            const effectivePermissions = [];
            for (const roleID in rolePermissions) {
                effectivePermissions.push(...Object.values(rolePermissions[roleID]));
            }
            return effectivePermissions;
        } catch (error) {
            throw new Error(error.message || "Could not fetch effective permissions.");
        }
    }

    // Get permission overrides for a user
    static async getPermissionOverrides(userID) {
        try {
            const user = await User.findByPk(userID, {
                include: [
                    { model: UserPermissionOverride, include: [{ model: Permission }] },
                ],
            });
            if (!user) throw new Error("User not found.");
            return user.UserPermissionOverrides;
        } catch (error) {
            throw new Error(error.message || "Could not fetch permission overrides.");
        }
    }
}

module.exports = PermissionService;