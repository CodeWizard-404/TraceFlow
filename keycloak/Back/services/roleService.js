const axios = require('axios');
const { Role, Permission, User } = require('../models');
require('dotenv').config();
const PermissionService = require('./permissionService');

// Keycloak configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';

// Get admin token for Keycloak operations
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

// Get client UUID from Keycloak
async function getClientUUID(token) {
    const response = await axios.get(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const client = response.data.find(c => c.clientId === CLIENT_ID);
    if (!client) throw new Error(`Client ${CLIENT_ID} not found in realm ${REALM}`);
    return client.id;
}

class RoleService {
    // Create a new role in both local DB and Keycloak
    static async createRole(name, description) {
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);

        // Step 1: Check if the role exists in Keycloak
        let keycloakRoleId;
        try {
            const response = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${name}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            keycloakRoleId = response.data.id;
        } catch (error) {
            if (error.response?.status === 404) {
                // Step 2: Create the role in Keycloak if it doesn’t exist
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

                // Step 3: Create the policy for the role in Keycloak
                await axios.post(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role`,
                    {
                        name: `${name}-policy`,
                        description: `Policy for ${name} role`,
                        logic: 'POSITIVE',
                        type: 'role',
                        roles: [{ id: keycloakRoleId, required: true }],
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log(`Created role ${name} and policy in Keycloak`);
            } else {
                throw new Error(`Failed to check/create role in Keycloak: ${error.message}`);
            }
        }

        // Step 4: Create or find the role in the local DB
        const [role, created] = await Role.findOrCreate({
            where: { name },
            defaults: { name, description },
        });
        if (!created) throw new Error(`Role '${name}' already exists in the database`);

        console.log(`Created role ${name} in local DB`);
        return role;
    }

    // Get all roles from the local database
    static async getAllRoles() {
        return await Role.findAll({ attributes: ['roleID', 'name', 'description'] });
    }

    // Get a specific role by ID, including its permissions
    static async getRoleById(roleID) {
        const role = await Role.findByPk(roleID, {
            include: [{ model: Permission, through: { attributes: [] }, attributes: ['name', 'description'] }],
        });
        if (!role) throw new Error('Role not found');
        return role;
    }

    // Delete a role from both local DB and Keycloak
    static async deleteRole(roleID) {
        const role = await Role.findByPk(roleID);
        if (!role) throw new Error('Role not found');

        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);

        // Step 1: Delete the role’s policy from Keycloak
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
                console.log(`Deleted policy ${role.name}-policy from Keycloak`);
            }
        } catch (error) {
            if (error.response?.status !== 404) throw error; // Ignore if policy doesn’t exist
        }

        // Step 2: Delete the role from Keycloak
        await axios.delete(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`Deleted role ${role.name} from Keycloak`);

        // Step 3: Delete the role from the local DB
        await role.destroy();
        console.log(`Deleted role ${role.name} from local DB`);

        return { message: `Role ${roleID} deleted successfully` };
    }

    // Update a role’s details in both local DB and Keycloak
    static async updateRole(roleID, updates) {
        const role = await Role.findByPk(roleID);
        if (!role) throw new Error('Role not found');

        const token = await getAdminToken();

        // Step 1: Update the role in Keycloak
        await axios.put(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
            {
                name: updates.name || role.name,
                description: updates.description || role.description,
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`Updated role ${role.name} in Keycloak`);

        // Step 2: Update the local DB
        await role.update({
            name: updates.name || role.name,
            description: updates.description || role.description,
        });
        console.log(`Updated role ${role.name} in local DB`);

        return role;
    }

    // Assign roles to a user in both local DB and Keycloak
    static async assignRolesToUser(userID, roleIDs) {
        const token = await getAdminToken();
        const user = await User.findByPk(userID);
        if (!user) throw new Error('User not found');

        // Step 1: Validate all roles exist
        const roles = await Role.findAll({ where: { roleID: roleIDs } });
        if (roles.length !== roleIDs.length) throw new Error('One or more roles not found');

        // Step 2: Filter out roles the user already has
        const currentRoles = await user.getRoles();
        const currentRoleIDs = currentRoles.map(r => r.roleID);
        const newRoles = roles.filter(r => !currentRoleIDs.includes(r.roleID));

        if (newRoles.length > 0) {
            // Step 3: Assign roles in the local DB
            await user.addRoles(newRoles);
            console.log(`Assigned ${newRoles.length} roles to user ${userID} in local DB`);

            // Step 4: Assign roles in Keycloak
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
            console.log(`Assigned ${newRoles.length} roles to user ${userID} in Keycloak`);
        }

        return {
            userID,
            assignedRoles: newRoles.map(r => r.name),
            totalAssigned: (await user.getRoles()).length,
        };
    }

    // Revoke roles from a user in both local DB and Keycloak
    static async revokeRolesFromUser(userID, roleIDs) {
        const token = await getAdminToken();
        const user = await User.findByPk(userID);
        if (!user) throw new Error('User not found');

        const results = [];
        for (const roleID of roleIDs) {
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error(`Role not found: ${roleID}`);

            // Step 1: Check if the user has this role
            const hasRole = await user.hasRole(role);
            if (!hasRole) throw new Error(`User does not have role: ${roleID}`);

            // Step 2: Remove the role from the local DB
            await user.removeRole(role);
            console.log(`Revoked role ${role.name} from user ${userID} in local DB`);

            // Step 3: Remove the role from Keycloak
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
            console.log(`Revoked role ${role.name} from user ${userID} in Keycloak`);

            results.push({
                userID,
                revokedRole: role.name,
                totalAssigned: (await user.getRoles()).length,
            });
        }

        return results.length === 1 ? results[0] : results;
    }

    // Get all roles assigned to a user
    static async getRolesByUser(userID) {
        const user = await User.findByPk(userID, {
            include: [
                {
                    model: Role,
                    through: { attributes: [] },
                    attributes: ['roleID', 'name', 'description'],
                    include: [{ model: Permission, through: { attributes: [] }, attributes: ['name', 'description'] }],
                },
            ],
        });
        if (!user) throw new Error('User not found');
        return user.Roles;
    }





    // Reset main roles to their default state
    static async resetMainRolesToDefault() {
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);

        // Define the default roles and their permissions (your provided default state)
        const defaultRoles = [
            {
                name: "Super Admin",
                description: "Role with full administrative privileges",
                permissions: [] // We'll assign all permissions for Super Admin
            },
            {
                name: "Admin",
                description: "Manage Users",
                permissions: [
                    // Permission Class
                    "access_all_permissions",
                    "access_permission_details",
                    "assign_permissions",
                    "revoke_permissions",
                    "access_permissions_by_role",
                    "create_permission_overrides",
                    "delete_permission_overrides",
                    // Role Class
                    "create_roles",
                    "read_role_details",
                    "update_roles",
                    "delete_roles",
                    "access_all_roles",
                    "revoke_roles",
                    "assign_roles",
                    // User Class
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
                    // Checklist Class
                    "create_checklists_items",
                    "access_checklist_item_details",
                    "update_checklists_items",
                    "delete_checklists_items",
                    "access_checklists_items",
                    // Reason Class
                    "create_reason_items",
                    "access_reason_item_details",
                    "update_reason_items",
                    "delete_reason_items",
                    "access_reason_items"
                ]
            },
            {
                name: "Supervisor",
                description: "Log Visits",
                permissions: [
                    // Agent Class
                    "access_agents_by_location",
                    "access_agents_locations",
                    "access_agents_by_phone",
                    "access_agents_by_id",
                    // Checklist Class
                    "access_checklist_item_details",
                    "access_visit_checklist",
                    // Reason Class
                    "access_reason_item_details",
                    "access_visit_reasons",
                    // ReceiptBook Class
                    "access_all_receipt_books",
                    "access_receipt_book_details",
                    "access_receipt_books_by_holder",
                    "access_receipt_books_by_number",
                    "collect_supplier_receipt_books",
                    "transfer_receipt_books",
                    "validate_receipt_books_transfer",
                    // ReceiptStub Class
                    "collect_receipt_stubs",
                    "validate_receipt_stubs",
                    // Visit Class
                    "scan_visits",
                    "edit_visit_details",
                    "delete_visit",
                    "log_visits",
                    "access_visit_details",
                    // User Class
                    "access_user_details",
                    "access_users_by_role",
                    "access_user_by_phone",
                    "access_all_users",
                    "access_managers",
                    // Timesheet Class
                    "access_timesheet_details",
                    "access_supervisor_timesheets",
                    "create_self_timesheets"
                ]
            },
            {
                name: "Manager",
                description: "Manage Supervisors",
                permissions: [
                    // Agent Class
                    "access_agents_by_location",
                    "access_agents_locations",
                    "access_agents_by_phone",
                    "access_agents_by_id",
                    // Checklist Class
                    "access_checklist_item_details",
                    "access_visit_checklist",
                    // Reason Class
                    "access_reason_item_details",
                    "access_visit_reasons",
                    // Visit Class
                    "edit_visit_details",
                    "delete_visit",
                    "access_visit_details",
                    // User Class
                    "access_user_details",
                    "access_users_by_role",
                    "access_supervisors",
                    "access_user_by_phone",
                    "access_all_users",
                    // Timesheet Class
                    "access_timesheet_details",
                    "create_timesheets_for_supervisor",
                    "access_supervisor_timesheets",
                    "validate_timesheets"
                ]
            },
            {
                name: "Stock Manager",
                description: "Archive Stock",
                permissions: [
                    // Agent Class
                    "access_agents_by_location",
                    "access_agents_locations",
                    "access_agents_by_phone",
                    "access_agents_by_id",
                    // ReceiptBook Class
                    "access_all_receipt_books",
                    "access_receipt_book_details",
                    "access_receipt_books_by_holder",
                    "access_receipt_books_by_number",
                    "delete_receipt_books",
                    "update_receipt_books",
                    "transfer_receipt_books",
                    "validate_receipt_books_transfer",
                    "access_receipt_book_history",
                    // User Class
                    "access_user_details",
                    "access_users_by_role",
                    "access_user_by_phone",
                    "access_all_users",
                    // ReceiptStub Class
                    "archive_receipt_stubs"
                ]
            },
            {
                name: "Regional Manager",
                description: "Manage Books",
                permissions: [
                    // Agent Class
                    "access_agents_by_location",
                    "access_agents_locations",
                    "access_agents_by_phone",
                    "access_agents_by_id",
                    // ReceiptBook Class
                    "access_all_receipt_books",
                    "access_receipt_book_details",
                    "access_receipt_books_by_holder",
                    "access_receipt_books_by_number",
                    "transfer_receipt_books",
                    "validate_receipt_books_transfer",
                    "access_receipt_book_history",
                    // User Class
                    "access_user_details",
                    "access_users_by_role",
                    "access_user_by_phone",
                    "access_all_users"
                ]
            },
            {
                name: "Purchase Team",
                description: "Manage Initial Stock",
                permissions: [
                    // Agent Class
                    "access_agents_by_location",
                    "access_agents_locations",
                    "access_agents_by_phone",
                    "access_agents_by_id",
                    // ReceiptBook Class
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
                    // User Class
                    "access_user_details",
                    "access_users_by_role",
                    "access_user_by_phone",
                    "access_all_users"
                ]
            }
        ];

        const results = [];

        // Get all current permissions from the database
        const allPermissions = await Permission.findAll();
        const allPermissionNames = allPermissions.map(p => p.name);

        for (const defaultRole of defaultRoles) {
            // Step 1: Find or create the role in the database
            let role = await Role.findOne({ where: { name: defaultRole.name } });
            if (!role) {
                role = await RoleService.createRole(defaultRole.name, defaultRole.description);
            } else {
                // Update description if it has changed
                if (role.description !== defaultRole.description) {
                    await role.update({ description: defaultRole.description });
                }
            }

            // Step 2: Handle permissions
            let permissionIDsToAssign = [];
            if (defaultRole.name === "Super Admin") {
                // Super Admin gets all permissions
                permissionIDsToAssign = allPermissions.map(p => p.permissionID);
            } else {
                // Filter permissions that exist in the database
                permissionIDsToAssign = allPermissions
                    .filter(p => defaultRole.permissions.includes(p.name))
                    .map(p => p.permissionID);
            }

            // Get current permissions for the role
            const currentPermissions = await role.getPermissions();
            const currentPermissionNames = currentPermissions.map(p => p.name);

            // Permissions to revoke (those not in default state)
            const permissionsToRevoke = currentPermissions
                .filter(p => defaultRole.name === "Super Admin" ? false : !defaultRole.permissions.includes(p.name))
                .map(p => p.permissionID);

            // Permissions to assign (those missing from current state)
            const permissionsToAssign = permissionIDsToAssign.filter(id =>
                !currentPermissions.some(p => p.permissionID === id));

            // Revoke extra permissions
            if (permissionsToRevoke.length > 0) {
                await PermissionService.revokePermissionsFromRole(role.roleID, permissionsToRevoke);
            }

            // Assign missing permissions
            if (permissionsToAssign.length > 0) {
                await PermissionService.assignPermissionsToRole(role.roleID, permissionsToAssign);
            }

            results.push({
                roleName: defaultRole.name,
                permissionsAssigned: permissionsToAssign.length,
                permissionsRevoked: permissionsToRevoke.length,
                totalPermissions: defaultRole.name === "Super Admin" ? allPermissions.length : permissionIDsToAssign.length
            });
        }

        console.log(`Reset ${results.length} main roles to default state`);
        return results;
    }
}

module.exports = RoleService;