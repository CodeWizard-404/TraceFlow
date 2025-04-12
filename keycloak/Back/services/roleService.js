const axios = require("axios");
const { Role, Permission, User } = require("../models");
const PermissionService = require("./permissionService");
require("dotenv").config();

// Keycloak configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || "http://localhost:8080";
const REALM = process.env.REALM || "TraceFlow";
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || "traceflow-backend";

// Roles that cannot be modified or deleted
const RESTRICTED_ROLES = [
    "Super Admin",
    "Admin",
    "Manager",
    "Supervisor",
    "Purchase Team",
    "Regional Manager",
    "Stock Manager",
];

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

class RoleService {
    // Create a new role
    static async createRole(name, description) {
        try {
            const token = await getAdminToken();
            const clientUUID = await getClientUUID(token);

            // Check or create role in Keycloak
            let keycloakRoleId;
            try {
                const response = await axios.get(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${name}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                keycloakRoleId = response.data.id;
            } catch (error) {
                if (error.response?.status === 404) {
                    await axios.post(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/roles`,
                        { name, description },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    const keycloakRole = await axios.get(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${name}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    keycloakRoleId = keycloakRole.data.id;

                    // Create policy in Keycloak
                    await axios.post(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role`,
                        {
                            name: `${name}-policy`,
                            description: `Policy for ${name} role`,
                            logic: "POSITIVE",
                            type: "role",
                            roles: [{ id: keycloakRoleId, required: true }],
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } else {
                    throw new Error("Could not create role in Keycloak.");
                }
            }

            // Save role in local DB
            const [role, created] = await Role.findOrCreate({
                where: { name },
                defaults: { name, description },
            });
            if (!created) throw new Error("Role already exists.");

            return role;
        } catch (error) {
            throw new Error(error.message || "Could not create role.");
        }
    }

    // Get all roles
    static async getAllRoles() {
        try {
            return await Role.findAll({
                attributes: ["roleID", "name", "description"],
            });
        } catch (error) {
            throw new Error("Could not fetch roles.");
        }
    }

    // Get role by ID
    static async getRoleById(roleID) {
        try {
            const role = await Role.findByPk(roleID, {
                include: [
                    {
                        model: Permission,
                        through: { attributes: [] },
                        attributes: ["name", "description"],
                    },
                ],
            });
            if (!role) throw new Error("Role not found.");
            return role;
        } catch (error) {
            throw new Error(error.message || "Could not fetch role.");
        }
    }

    // Update a role
    static async updateRole(roleID, updates) {
        try {
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error("Role not found.");

            // Block name updates for restricted roles
            if (RESTRICTED_ROLES.includes(role.name) && updates.name) {
                throw new Error(`Cannot rename ${role.name} role.`);
            }

            const token = await getAdminToken();

            // Update Keycloak role
            await axios.put(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
                {
                    name: updates.name || role.name,
                    description: updates.description || role.description,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Update local DB
            await role.update({
                name: updates.name || role.name,
                description: updates.description || role.description,
            });

            return role;
        } catch (error) {
            throw new Error(error.message || "Could not update role.");
        }
    }

    // Delete a role
    static async deleteRole(roleID) {
        try {
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error("Role not found.");

            // Block deletion of restricted roles
            if (RESTRICTED_ROLES.includes(role.name)) {
                throw new Error(`Cannot delete ${role.name} role.`);
            }

            const token = await getAdminToken();
            const clientUUID = await getClientUUID(token);

            // Delete policy from Keycloak
            try {
                const policyResponse = await axios.get(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role?name=${role.name}-policy`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (policyResponse.data[0]?.id) {
                    await axios.delete(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/${policyResponse.data[0].id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                }
            } catch (error) {
                if (error.response?.status !== 404) throw error;
            }

            // Delete role from Keycloak
            await axios.delete(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Delete from local DB
            await role.destroy();

            return { message: "Role deleted successfully." };
        } catch (error) {
            throw new Error(error.message || "Could not delete role.");
        }
    }

    // Assign roles to a user
    static async assignRolesToUser(userID, roleIDs) {
        try {
            const token = await getAdminToken();
            const user = await User.findByPk(userID);
            if (!user) throw new Error("User not found.");

            // Validate roles
            const roles = await Role.findAll({ where: { roleID: roleIDs } });
            if (roles.length !== roleIDs.length)
                throw new Error("One or more roles not found.");

            // Filter new roles
            const currentRoles = await user.getRoles();
            const currentRoleIDs = currentRoles.map((r) => r.roleID);
            const newRoles = roles.filter((r) => !currentRoleIDs.includes(r.roleID));

            if (newRoles.length > 0) {
                // Assign in local DB
                await user.addRoles(newRoles);

                // Assign in Keycloak
                const roleMappings = [];
                for (const role of newRoles) {
                    const roleData = await axios.get(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    roleMappings.push({ id: roleData.data.id, name: role.name });
                }
                await axios.post(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}/role-mappings/realm`,
                    roleMappings,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }

            return {
                userID,
                assignedRoles: newRoles.map((r) => r.name),
                totalAssigned: (await user.getRoles()).length,
            };
        } catch (error) {
            throw new Error(error.message || "Could not assign roles.");
        }
    }

    // Revoke roles from a user
    static async revokeRolesFromUser(userID, roleIDs) {
        try {
            const token = await getAdminToken();
            const user = await User.findByPk(userID);
            if (!user) throw new Error("User not found.");

            const results = [];
            for (const roleID of roleIDs) {
                const role = await Role.findByPk(roleID);
                if (!role) throw new Error("Role not found.");

                // Check if user has the role
                const hasRole = await user.hasRole(role);
                if (!hasRole) throw new Error(`User does not have role: ${role.name}.`);

                // Remove from local DB
                await user.removeRole(role);

                // Remove from Keycloak
                const roleData = await axios.get(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                await axios.delete(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}/role-mappings/realm`,
                    {
                        data: [{ id: roleData.data.id, name: role.name }],
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                results.push({
                    userID,
                    revokedRole: role.name,
                    totalAssigned: (await user.getRoles()).length,
                });
            }

            return results.length === 1 ? results[0] : results;
        } catch (error) {
            throw new Error(error.message || "Could not revoke roles.");
        }
    }

    // Get roles for a user
    static async getRolesByUser(userID) {
        try {
            const user = await User.findByPk(userID, {
                include: [
                    {
                        model: Role,
                        through: { attributes: [] },
                        attributes: ["roleID", "name", "description"],
                        include: [
                            {
                                model: Permission,
                                through: { attributes: [] },
                                attributes: ["name", "description"],
                            },
                        ],
                    },
                ],
            });
            if (!user) throw new Error("User not found.");
            return user.Roles;
        } catch (error) {
            throw new Error(error.message || "Could not fetch user roles.");
        }
    }

    // Reset main roles to default
    static async resetMainRolesToDefault() {
        try {
            const token = await getAdminToken();
            const clientUUID = await getClientUUID(token);

            // Default roles configuration
            const defaultRoles = [
                {
                    name: "Super Admin",
                    description: "Full administrative privileges",
                    permissions: [], // Will assign all permissions
                },
                {
                    name: "Admin",
                    description: "Manage users",
                    permissions: [
                        "access_all_permissions",
                        "access_permission_details",
                        "assign_permissions",
                        "revoke_permissions",
                        "access_permissions_by_role",
                        "create_permission_overrides",
                        "delete_permission_overrides",
                        "create_roles",
                        "read_role_details",
                        "update_roles",
                        "delete_roles",
                        "access_all_roles",
                        "revoke_roles",
                        "assign_roles",
                        "access_user_details",
                        "assign_supervisors",
                        "access_users_by_role",
                        "revoke_supervisors",
                        "create_users",
                        "access_supervisors",
                        "access_user_by_phone",
                        "delete_users",
                        "access_all_users",
                        "update_users",
                        "access_managers",
                        "create_checklists_items",
                        "access_checklist_item_details",
                        "update_checklists_items",
                        "delete_checklists_items",
                        "access_checklists_items",
                        "create_reason_items",
                        "access_reason_item_details",
                        "update_reason_items",
                        "delete_reason_items",
                        "access_reason_items",
                    ],
                },
                {
                    name: "Supervisor",
                    description: "Log visits",
                    permissions: [
                        "access_agents_by_location",
                        "access_agents_locations",
                        "access_agents_by_phone",
                        "access_agents_by_id",
                        "access_checklist_item_details",
                        "access_visit_checklist",
                        "access_reason_item_details",
                        "access_visit_reasons",
                        "access_all_receipt_books",
                        "access_receipt_book_details",
                        "access_receipt_books_by_holder",
                        "access_receipt_books_by_number",
                        "collect_supplier_receipt_books",
                        "transfer_receipt_books",
                        "validate_receipt_books_transfer",
                        "collect_receipt_stubs",
                        "validate_receipt_stubs",
                        "scan_visits",
                        "edit_visit_details",
                        "delete_visit",
                        "log_visits",
                        "access_visit_details",
                        "access_user_details",
                        "access_users_by_role",
                        "access_user_by_phone",
                        "access_all_users",
                        "access_managers",
                        "access_timesheet_details",
                        "access_supervisor_timesheets",
                        "create_self_timesheets",
                    ],
                },
                {
                    name: "Manager",
                    description: "Manage supervisors",
                    permissions: [
                        "access_agents_by_location",
                        "access_agents_locations",
                        "access_agents_by_phone",
                        "access_agents_by_id",
                        "access_checklist_item_details",
                        "access_visit_checklist",
                        "access_reason_item_details",
                        "access_visit_reasons",
                        "edit_visit_details",
                        "delete_visit",
                        "access_visit_details",
                        "access_user_details",
                        "access_users_by_role",
                        "access_supervisors",
                        "access_user_by_phone",
                        "access_all_users",
                        "access_timesheet_details",
                        "create_timesheets_for_supervisor",
                        "access_supervisor_timesheets",
                        "validate_timesheets",
                    ],
                },
                {
                    name: "Stock Manager",
                    description: "Archive stock",
                    permissions: [
                        "access_agents_by_location",
                        "access_agents_locations",
                        "access_agents_by_phone",
                        "access_agents_by_id",
                        "access_all_receipt_books",
                        "access_receipt_book_details",
                        "access_receipt_books_by_holder",
                        "access_receipt_books_by_number",
                        "delete_receipt_books",
                        "update_receipt_books",
                        "transfer_receipt_books",
                        "validate_receipt_books_transfer",
                        "access_receipt_book_history",
                        "access_user_details",
                        "access_users_by_role",
                        "access_user_by_phone",
                        "access_all_users",
                        "archive_receipt_stubs",
                    ],
                },
                {
                    name: "Regional Manager",
                    description: "Manage books",
                    permissions: [
                        "access_agents_by_location",
                        "access_agents_locations",
                        "access_agents_by_phone",
                        "access_agents_by_id",
                        "access_all_receipt_books",
                        "access_receipt_book_details",
                        "access_receipt_books_by_holder",
                        "access_receipt_books_by_number",
                        "transfer_receipt_books",
                        "validate_receipt_books_transfer",
                        "access_receipt_book_history",
                        "access_user_details",
                        "access_users_by_role",
                        "access_user_by_phone",
                        "access_all_users",
                    ],
                },
                {
                    name: "Purchase Team",
                    description: "Manage initial stock",
                    permissions: [
                        "access_agents_by_location",
                        "access_agents_locations",
                        "access_agents_by_phone",
                        "access_agents_by_id",
                        "create_receipt_books",
                        "access_all_receipt_books",
                        "access_receipt_book_details",
                        "access_receipt_books_by_holder",
                        "access_receipt_books_by_number",
                        "delete_receipt_books",
                        "update_receipt_books",
                        "send_receipt_books",
                        "collect_supplier_receipt_books",
                        "transfer_receipt_books",
                        "validate_receipt_books_transfer",
                        "access_receipt_book_history",
                        "access_user_details",
                        "access_users_by_role",
                        "access_user_by_phone",
                        "access_all_users",
                    ],
                },
            ];

            const results = [];

            // Get all permissions
            const allPermissions = await Permission.findAll();
            const allPermissionNames = allPermissions.map((p) => p.name);

            for (const defaultRole of defaultRoles) {
                // Find or create role
                let role = await Role.findOne({ where: { name: defaultRole.name } });
                if (!role) {
                    role = await RoleService.createRole(
                        defaultRole.name,
                        defaultRole.description
                    );
                } else if (role.description !== defaultRole.description) {
                    await role.update({ description: defaultRole.description });
                }

                // Assign permissions
                let permissionIDsToAssign =
                    defaultRole.name === "Super Admin"
                        ? allPermissions.map((p) => p.permissionID)
                        : allPermissions
                            .filter((p) => defaultRole.permissions.includes(p.name))
                            .map((p) => p.permissionID);

                const currentPermissions = await role.getPermissions();
                const currentPermissionIDs = currentPermissions.map(
                    (p) => p.permissionID
                );

                // Revoke extra permissions
                const permissionsToRevoke = currentPermissions
                    .filter(
                        (p) =>
                            defaultRole.name !== "Super Admin" &&
                            !defaultRole.permissions.includes(p.name)
                    )
                    .map((p) => p.permissionID);
                if (permissionsToRevoke.length > 0) {
                    await PermissionService.revokePermissionsFromRole(
                        role.roleID,
                        permissionsToRevoke
                    );
                }

                // Assign missing permissions
                const permissionsToAssign = permissionIDsToAssign.filter(
                    (id) => !currentPermissionIDs.includes(id)
                );
                if (permissionsToAssign.length > 0) {
                    await PermissionService.assignPermissionsToRole(
                        role.roleID,
                        permissionsToAssign
                    );
                }

                results.push({
                    roleName: defaultRole.name,
                    permissionsAssigned: permissionsToAssign.length,
                    permissionsRevoked: permissionsToRevoke.length,
                    totalPermissions:
                        defaultRole.name === "Super Admin"
                            ? allPermissions.length
                            : permissionIDsToAssign.length,
                });
            }

            return results;
        } catch (error) {
            throw new Error(error.message || "Could not reset roles.");
        }
    }
}

module.exports = RoleService;