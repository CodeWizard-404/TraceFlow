const axios = require('axios');
const { Role, Permission, User } = require('../models');
const PermissionService = require('./permissionService');
const logger = require('../utils/logger');
require('dotenv').config();

// Keycloak configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';

// Roles that cannot be modified or deleted
const RESTRICTED_ROLES = [
    'Super Admin',
    'Admin',
    'Manager',
    'Supervisor',
    'Purchase Team',
    'Regional Manager',
    'Stock Manager',
];

// Get admin token for Keycloak
async function getAdminToken() {
    try {
        logger.debug(`Attempting Keycloak authentication with user: ${process.env.KEYCLOAK_ADMIN_USER}`);
        const response = await axios.post(
            `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: 'password',
                client_id: 'admin-cli',
                username: process.env.KEYCLOAK_ADMIN_USER,
                password: process.env.KEYCLOAK_ADMIN_PASSWORD,
            }),
            { timeout: 5000 }
        );
        return response.data.access_token;
    } catch (error) {
        const errorDetails = error.response?.data?.error_description || error.message;
        logger.error(`Keycloak authentication failed: ${errorDetails}`);
        throw new Error(`Could not authenticate with Keycloak: ${errorDetails}`);
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
        logger.error(`Failed to fetch client UUID: ${error.message}`);
        throw new Error('Could not find client in Keycloak.');
    }
}

class RoleService {
    // Create a new role
    static async createRole(name, description, actorID) {
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
                            logic: 'POSITIVE',
                            type: 'role',
                            roles: [{ id: keycloakRoleId, required: true }],
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } else {
                    throw new Error('Could not create role in Keycloak.');
                }
            }

            // Save role in local DB
            const [role, created] = await Role.findOrCreate({
                where: { name },
                defaults: { name, description },
            });
            if (!created) throw new Error('Role already exists.');

            return role;
        } catch (error) {
            logger.error(`Create role error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || 'Could not create role.');
        }
    }

    // Get all roles
    static async getAllRoles() {
        try {
            const roles = await Role.findAll({
                attributes: ['roleID', 'name', 'description'],
                include: [
                    {
                        model: Permission,
                        attributes: ['permissionID', 'name', 'description'],
                        through: { attributes: [] }, // Exclude RolePermissions table attributes
                    },
                ],
            });
            return roles;
        } catch (error) {
            logger.error(`Fetch roles error: ${error.message}`, { ip: null });
            throw new Error('Could not fetch roles.');
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
                        attributes: ['name', 'description'],
                    },
                ],
            });
            if (!role) throw new Error('Role not found.');
            return role;
        } catch (error) {
            logger.error(`Get role error: ${error.message}`, { ip: null });
            throw new Error(error.message || 'Could not fetch role.');
        }
    }

    // Update a role
    static async updateRole(roleID, updates, actorID) {
        try {
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error('Role not found.');

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
            logger.error(`Update role error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || 'Could not update role.');
        }
    }

    // Delete a role
    static async deleteRole(roleID, actorID) {
        try {
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error('Role not found.');

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

            return { message: 'Role deleted successfully.' };
        } catch (error) {
            logger.error(`Delete role error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || 'Could not delete role.');
        }
    }

    // Assign roles to a user
    static async assignRolesToUser(userID, roleIDs, actorID) {
        try {
            const token = await getAdminToken();
            const user = await User.findByPk(userID);
            if (!user) throw new Error('User not found.');

            // Validate roles
            const roles = await Role.findAll({ where: { roleID: roleIDs } });
            if (roles.length !== roleIDs.length) throw new Error('One or more roles not found.');

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
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}/role-mappings/realm`,
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
            logger.error(`Assign roles error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || 'Could not assign roles.');
        }
    }

    // Revoke roles from a user
    static async revokeRolesFromUser(userID, roleIDs, actorID) {
        try {
            const token = await getAdminToken();
            const user = await User.findByPk(userID);
            if (!user) throw new Error('User not found.');

            const results = [];
            for (const roleID of roleIDs) {
                const role = await Role.findByPk(roleID);
                if (!role) throw new Error('Role not found.');

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
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}/role-mappings/realm`,
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
            logger.error(`Revoke roles error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || 'Could not revoke roles.');
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
                        attributes: ['roleID', 'name', 'description'],
                        include: [
                            {
                                model: Permission,
                                through: { attributes: [] },
                                attributes: ['name', 'description'],
                            },
                        ],
                    },
                ],
            });
            if (!user) throw new Error('User not found.');
            return user.Roles;
        } catch (error) {
            logger.error(`Get user roles error: ${error.message}`, { ip: null });
            throw new Error(error.message || 'Could not fetch user roles.');
        }
    }

    // Reset main roles to default
    static async resetMainRolesToDefault(actorID) {
        try {
            const token = await getAdminToken();
            const clientUUID = await getClientUUID(token);

            // Default roles configuration
            const defaultRoles = [
                {
                    name: 'Super Admin',
                    description: 'Role with full administrative privileges',
                    permissions: [
                        // Class: Agent
                        'access_agents_by_delegation',
                        'access_agents_locations',
                        'access_agents_by_phone',
                        'access_agent_supervisor',
                        'create_agents',
                        'access_agents_by_user',
                        'access_all_agents',
                        'access_agents_by_id',
                        'update_agents',
                        'delete_agents',
                        // Class: Checklist
                        'create_checklists_items',
                        'access_checklist_item_details',
                        'delete_checklists_items',
                        'update_checklists_items',
                        'access_checklists_items',
                        'access_visit_checklist',
                        // Class: Location
                        'access_regions',
                        'access_governorates',
                        'access_delegations',
                        'access_delegations_by_governorate',
                        'access_governorates_by_region',
                        'access gions_by_governorate',
                        'access_governorates_by_delegation',
                        // Class: User
                        'access_regions_by_user',
                        'access_governorates_by_user',
                        'access_delegations_by_user',
                        'access_director',
                        'assign_supervisor_to_agent',
                        'revoke_governorates',
                        'access_users_by_delegation',
                        'assign_google_account',
                        'create_users',
                        'access_supervisors',
                        'assign_director',
                        'revoke_regions',
                        'access_users_by_region',
                        'access_director_by_regional_manager',
                        'access_user_details',
                        'access_regional_managers',
                        'revoke_director',
                        'assign_governorates',
                        'access_supervisors_by_regional_manager',
                        'access_all_users',
                        'update_users',
                        'revoke_regional_manager',
                        'assign_regions',
                        'revoke_delegations',
                        'access_users_by_governorate',
                        'access_regional_manager_by_supervisor',
                        'access_users_by_role',
                        'assign_regional_manager',
                        'revoke_supervisor_from_agent',
                        'assign_delegations',
                        'access_regional_managers_by_director',
                        'access_user_by_phone',
                        'delete_users',
                        // Class: Permission
                        'access_all_permissions',
                        'create_permissions',
                        'update_permissions',
                        'delete_permissions',
                        'access_permission_details',
                        'assign_permissions',
                        'revoke_permissions',
                        'access_permissions_by_role',
                        'create_permission_overrides',
                        'delete_permission_overrides',
                        // Class: Notification
                        'manage_notification_rules',
                        'view_notification_rules',
                        // Class: Reason
                        'create_reason_items',
                        'access_reason_item_details',
                        'update_reason_items',
                        'delete_reason_items',
                        'access_reason_items',
                        'access_visit_reasons',
                        // Class: Role
                        'reset_roles',
                        'create_roles',
                        'access_all_roles',
                        'read_role_details',
                        'update_roles',
                        'delete_roles',
                        'assign_roles',
                        'revoke_roles',
                        // Class: Timesheet
                        'create_timesheets_for_supervisor',
                        'access_supervisor_timesheets',
                        'create_self_timesheets',
                        'access_all_timesheets',
                        'validate_timesheets',
                        'access_timesheet_details',
                        // Class: ReceiptBook
                        'access_receipt_book_details',
                        'send_receipt_books',
                        'access_receipt_book_types',
                        'access_receipt_books_by_number',
                        'transfer_receipt_books',
                        'access_all_receipt_books',
                        'delete_receipt_books',
                        'access_receipt_book_history',
                        'create_receipt_books',
                        'update_receipt_books',
                        'validate_receipt_books_transfer',
                        'manage_receipt_book_types',
                        'access_receipt_books_by_holder',
                        'collect_supplier_receipt_books',
                        // Class: ReceiptStub
                        'collect_receipt_stubs',
                        'archive_receipt_stubs',
                        'validate_receipt_stubs',
                        // Class: Visit
                        'access_visit_details',
                        'scan_visits',
                        'edit_visit_details',
                        'log_visits',
                        'delete_visit',
                        // Class: Other
                        'view_csv_headers',
                        'update_csv_headers'
                    ],
                },
                {
                    name: 'Admin',
                    description: null,
                    permissions: [
                        // Class: Agent
                        'access_agents_by_delegation',
                        'access_agents_locations',
                        'access_agents_by_phone',
                        'access_agent_supervisor',
                        'create_agents',
                        'access_agents_by_user',
                        'access_all_agents',
                        'access_agents_by_id',
                        'update_agents',
                        'delete_agents',
                        // Class: Checklist
                        'create_checklists_items',
                        'access_checklist_item_details',
                        'delete_checklists_items',
                        'update_checklists_items',
                        'access_checklists_items',
                        // Class: Location
                        'access_regions',
                        'access_governorates',
                        'access_delegations',
                        'access_delegations_by_governorate',
                        'access_governorates_by_region',
                        'access_regions_by_governorate',
                        'access_governorates_by_delegation',
                        // Class: User
                        'access_governorates_by_user',
                        'access_delegations_by_user',
                        'access_director',
                        'assign_supervisor_to_agent',
                        'revoke_governorates',
                        'access_users_by_delegation',
                        'assign_google_account',
                        'create_users',
                        'access_supervisors',
                        'assign_director',
                        'revoke_regions',
                        'access_users_by_region',
                        'access_director_by_regional_manager',
                        'access_user_details',
                        'access_regional_managers',
                        'revoke_director',
                        'assign_governorates',
                        'access_supervisors_by_regional_manager',
                        'access_all_users',
                        'update_users',
                        'revoke_regional_manager',
                        'assign_regions',
                        'revoke_delegations',
                        'access_users_by_governorate',
                        'access_regional_manager_by_supervisor',
                        'access_users_by_role',
                        'assign_regional_manager',
                        'revoke_supervisor_from_agent',
                        'assign_delegations',
                        'access_regional_managers_by_director',
                        'access_user_by_phone',
                        'delete_users',
                        'access_regions_by_user',
                        // Class: Permission
                        'access_all_permissions',
                        'create_permissions',
                        'update_permissions',
                        'delete_permissions',
                        'access_permission_details',
                        'assign_permissions',
                        'revoke_permissions',
                        'access_permissions_by_role',
                        'create_permission_overrides',
                        'delete_permission_overrides',
                        // Class: Notification
                        'manage_notification_rules',
                        'view_notification_rules',
                        // Class: Reason
                        'create_reason_items',
                        'access_reason_item_details',
                        'update_reason_items',
                        'delete_reason_items',
                        'access_reason_items',
                        // Class: Role
                        'reset_roles',
                        'create_roles',
                        'access_all_roles',
                        'read_role_details',
                        'update_roles',
                        'delete_roles',
                        'assign_roles',
                        'revoke_roles',
                        // Class: Other
                        'view_csv_headers',
                        'update_csv_headers'
                    ],
                },
                {
                    name: 'Supervisor',
                    description: null,
                    permissions: [
                        // Class: Agent
                        'access_agents_by_delegation',
                        'access_agents_locations',
                        'access_agents_by_phone',
                        'access_agent_supervisor',
                        'create_agents',
                        'access_agents_by_user',
                        'access_all_agents',
                        'access_agents_by_id',
                        'update_agents',
                        'delete_agents',
                        // Class: Checklist
                        'access_checklist_item_details',
                        'access_checklists_items',
                        'access_visit_checklist',
                        // Class: Location
                        'access_regions',
                        'access_governorates',
                        'access_delegations',
                        'access_delegations_by_governorate',
                        'access_governorates_by_region',
                        'access_regions_by_governorate',
                        'access_governorates_by_delegation',
                        // Class: User
                        'access_governorates_by_user',
                        'access_delegations_by_user',
                        'access_supervisors',
                        'access_users_by_region',
                        'access_director_by_regional_manager',
                        'access_user_details',
                        'access_regional_managers',
                        'access_supervisors_by_regional_manager',
                        'access_all_users',
                        'access_users_by_governorate',
                        'access_regional_manager_by_supervisor',
                        'access_users_by_role',
                        'access_user_by_phone',
                        'access_regions_by_user',
                        'access_users_by_delegation',
                        // Class: Reason
                        'access_reason_item_details',
                        'access_reason_items',
                        'access_visit_reasons',
                        // Class: Timesheet
                        'access_supervisor_timesheets',
                        'access_timesheet_details',
                        'create_self_timesheets',
                        // Class: ReceiptBook
                        'access_receipt_book_details',
                        'access_receipt_book_types',
                        'access_receipt_books_by_number',
                        'transfer_receipt_books',
                        'validate_receipt_books_transfer',
                        'access_receipt_books_by_holder',
                        // Class: ReceiptStub
                        'collect_receipt_stubs',
                        'validate_receipt_stubs',
                        // Class: Visit
                        'access_visit_details',
                        'scan_visits',
                        'edit_visit_details',
                        'log_visits',
                        'delete_visit'
                    ],
                },
                {
                    name: 'Regional Manager',
                    description: null,
                    permissions: [
                        // Class: Agent
                        'access_agents_by_delegation',
                        'access_agents_locations',
                        'access_agents_by_phone',
                        'access_agent_supervisor',
                        'access_agents_by_user',
                        'access_all_agents',
                        'access_agents_by_id',
                        // Class: Checklist
                        'access_checklist_item_details',
                        'access_checklists_items',
                        'access_visit_checklist',
                        // Class: Location
                        'access_regions',
                        'access_governorates',
                        'access_delegations',
                        'access_delegations_by_governorate',
                        'access_governorates_by_region',
                        'access_regions_by_governorate',
                        'access_governorates_by_delegation',
                        // Class: User
                        'access_governorates_by_user',
                        'access_delegations_by_user',
                        'access_director',
                        'access_users_by_delegation',
                        'access_supervisors',
                        'access_users_by_region',
                        'access_director_by_regional_manager',
                        'access_user_details',
                        'access_all_receipt_books',
                        'access_receipt_book_history',
                        'access_regional_managers',
                        'access_supervisors_by_regional_manager',
                        'access_all_users',
                        'access_users_by_governorate',
                        'access_regional_manager_by_supervisor',
                        'access_users_by_role',
                        'access_regional_managers_by_director',
                        'access_user_by_phone',
                        'access_regions_by_user',
                        // Class: Reason
                        'access_reason_item_details',
                        'access_reason_items',
                        'access_visit_reasons',
                        // Class: Timesheet
                        'create_timesheets_for_supervisor',
                        'access_supervisor_timesheets',
                        'access_timesheet_details',
                        'validate_timesheets',
                        // Class: ReceiptBook
                        'access_receipt_book_details',
                        'access_receipt_book_types',
                        'access_receipt_books_by_number',
                        'transfer_receipt_books',
                        'validate_receipt_books_transfer',
                        'access_receipt_books_by_holder',
                        // Class: ReceiptStub
                        'collect_receipt_stubs',
                        'validate_receipt_stubs',
                        // Class: Visit
                        'access_visit_details',
                        'edit_visit_details',
                        'delete_visit'
                    ],
                },
                {
                    name: 'Manager',
                    description: null,
                    permissions: [
                        // Class: Agent
                        'access_agents_by_delegation',
                        'access_agents_locations',
                        'access_agents_by_phone',
                        'access_agent_supervisor',
                        'access_agents_by_user',
                        'access_all_agents',
                        'access_agents_by_id',
                        // Class: Checklist
                        'access_checklist_item_details',
                        'access_checklists_items',
                        'access_visit_checklist',
                        // Class: Location
                        'access_regions',
                        'access_governorates',
                        'access_delegations',
                        'access_delegations_by_governorate',
                        'access_governorates_by_region',
                        'access_regions_by_governorate',
                        'access_governorates_by_delegation',
                        // Class: User
                        'access_governorates_by_user',
                        'access_delegations_by_user',
                        'access_director',
                        'access_users_by_delegation',
                        'access_supervisors',
                        'access_users_by_region',
                        'access_director_by_regional_manager',
                        'access_user_details',
                        'access_regional_managers',
                        'access_supervisors_by_regional_manager',
                        'access_all_users',
                        'access_users_by_governorate',
                        'access_regional_manager_by_supervisor',
                        'access_users_by_role',
                        'access_regional_managers_by_director',
                        'access_user_by_phone',
                        'access_regions_by_user',
                        // Class: Reason
                        'access_reason_item_details',
                        'access_reason_items',
                        'access_visit_reasons',
                        // Class: Timesheet
                        'access_supervisor_timesheets',
                        'access_timesheet_details',
                        // Class: Visit
                        'access_visit_details'
                    ],
                },
                {
                    name: 'Purchase Team',
                    description: null,
                    permissions: [
                        // Class: User
                        'access_governorates_by_user',
                        'access_delegations_by_user',
                        'access_users_by_delegation',
                        'access_supervisors',
                        'access_users_by_region',
                        'access_director_by_regional_manager',
                        'access_user_details',
                        'access_regional_managers',
                        'access_supervisors_by_regional_manager',
                        'access_all_users',
                        'access_users_by_governorate',
                        'access_regional_manager_by_supervisor',
                        'access_users_by_role',
                        'access_regional_managers_by_director',
                        'access_user_by_phone',
                        'access_regions_by_user',
                        // Class: ReceiptBook
                        'access_receipt_book_details',
                        'send_receipt_books',
                        'access_receipt_book_types',
                        'access_receipt_books_by_number',
                        'transfer_receipt_books',
                        'access_all_receipt_books',
                        'delete_receipt_books',
                        'access_receipt_book_history',
                        'create_receipt_books',
                        'update_receipt_books',
                        'validate_receipt_books_transfer',
                        'manage_receipt_book_types',
                        'access_receipt_books_by_holder',
                        'collect_supplier_receipt_books'
                    ],
                },
                {
                    name: 'Stock Manager',
                    description: null,
                    permissions: [
                        // Class: Location
                        'access_regions',
                        'access_governorates',
                        'access_delegations',
                        'access_delegations_by_governorate',
                        'access_governorates_by_region',
                        'access_regions_by_governorate',
                        'access_governorates_by_delegation',
                        // Class: User
                        'access_governorates_by_user',
                        'access_delegations_by_user',
                        'access_director',
                        'access_users_by_delegation',
                        'access_supervisors',
                        'access_users_by_region',
                        'access_director_by_regional_manager',
                        'access_user_details',
                        'access_regional_managers',
                        'access_supervisors_by_regional_manager',
                        'access_all_users',
                        'access_users_by_governorate',
                        'access_regional_manager_by_supervisor',
                        'access_users_by_role',
                        'access_regional_managers_by_director',
                        'access_user_by_phone',
                        'access_regions_by_user',
                        // Class: ReceiptBook
                        'access_receipt_book_details',
                        'access_receipt_book_types',
                        'access_receipt_books_by_number',
                        'transfer_receipt_books',
                        'access_all_receipt_books',
                        'access_receipt_book_history',
                        'validate_receipt_books_transfer',
                        'access_receipt_books_by_holder',
                        // Class: ReceiptStub
                        'archive_receipt_stubs'
                    ],
                }
            ];

            const results = [];

            // Get all permissions from local DB
            const allPermissions = await Permission.findAll();
            const allPermissionNames = allPermissions.map((p) => p.name);

            // Validate permission names in defaultRoles
            for (const defaultRole of defaultRoles) {
                if (defaultRole.name !== 'Super Admin') {
                    const invalidPermissions = defaultRole.permissions.filter(
                        (p) => !allPermissionNames.includes(p)
                    );
                    if (invalidPermissions.length > 0) {
                        logger.warn(
                            `Invalid permissions for role ${defaultRole.name}: ${invalidPermissions.join(', ')}`
                        );
                    }
                }
            }

            // Create or update resources in Keycloak for each permission
            const resourceMap = new Map();
            for (const permission of allPermissions) {
                try {
                    // Check if resource exists
                    const resourceResponse = await axios.get(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource?search=${permission.name}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    let resourceId = resourceResponse.data.find((r) => r.name === permission.name)?._id;

                    if (!resourceId) {
                        // Create resource
                        const resourceData = await axios.post(
                            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource`,
                            {
                                name: permission.name,
                                displayName: permission.description || `Resource for ${permission.name}`,
                                type: 'urn:traceflow:resources:permission',
                                scopes: [{ name: 'access' }],
                            },
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        resourceId = resourceData.data._id;
                    } else {
                        // Update resource if needed
                        await axios.put(
                            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource/${resourceId}`,
                            {
                                name: permission.name,
                                displayName: permission.description || `Resource for ${permission.name}`,
                                type: 'urn:traceflow:resources:permission',
                                scopes: [{ name: 'access' }],
                            },
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                    }
                    resourceMap.set(permission.name, resourceId);
                    logger.debug(`Synced resource for permission ${permission.name} with ID ${resourceId}`);
                } catch (error) {
                    logger.error(`Failed to create/update resource for permission ${permission.name}: ${error.message}`);
                    throw new Error(`Could not sync resource for permission ${permission.name}`);
                }
            }

            // Map permissions to their associated role policies
            const permissionToPolicies = new Map();
            allPermissionNames.forEach((permName) => permissionToPolicies.set(permName, []));

            // Process roles and policies
            const rolePolicyMap = new Map();
            for (const defaultRole of defaultRoles) {
                // Find or create role in local DB and Keycloak
                let role = await Role.findOne({ where: { name: defaultRole.name } });
                let keycloakRoleId;
                if (!role) {
                    role = await RoleService.createRole(defaultRole.name, defaultRole.description, actorID);
                    const keycloakRole = await axios.get(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${defaultRole.name}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    keycloakRoleId = keycloakRole.data.id;
                } else {
                    if (role.description !== defaultRole.description) {
                        await role.update({ description: defaultRole.description });
                        await axios.put(
                            `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
                            {
                                name: role.name,
                                description: defaultRole.description,
                            },
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                    }
                    const keycloakRole = await axios.get(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    keycloakRoleId = keycloakRole.data.id;
                }
                logger.debug(`Processing role ${defaultRole.name} with Keycloak ID ${keycloakRoleId}`);

                // Create or update role-based policy
                let policyId;
                try {
                    const policyResponse = await axios.get(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role?name=${role.name}-policy`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    policyId = policyResponse.data[0]?.id;
                    if (policyId) {
                        await axios.put(
                            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role/${policyId}`,
                            {
                                name: `${role.name}-policy`,
                                description: `Policy for ${role.name} role`,
                                logic: 'POSITIVE',
                                type: 'role',
                                roles: [{ id: keycloakRoleId, required: true }],
                            },
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                    }
                } catch (error) {
                    if (error.response?.status === 404) {
                        const policyData = await axios.post(
                            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role`,
                            {
                                name: `${role.name}-policy`,
                                description: `Policy for ${role.name} role`,
                                logic: 'POSITIVE',
                                type: 'role',
                                roles: [{ id: keycloakRoleId, required: true }],
                            },
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        policyId = policyData.data.id;
                    } else {
                        throw error;
                    }
                }
                rolePolicyMap.set(defaultRole.name, policyId);
                logger.debug(`Synced policy for role ${role.name} with ID ${policyId}`);

                // Assign permissions to policies
                const permissionNamesToAssign =
                    defaultRole.name === 'Super Admin'
                        ? allPermissionNames
                        : defaultRole.permissions.filter((p) => allPermissionNames.includes(p));

                permissionNamesToAssign.forEach((permName) => {
                    if (permissionToPolicies.has(permName)) {
                        permissionToPolicies.get(permName).push(policyId);
                    }
                });

                // Update local DB permissions
                let permissionIDsToAssign =
                    defaultRole.name === 'Super Admin'
                        ? allPermissions.map((p) => p.permissionID)
                        : allPermissions
                            .filter((p) => defaultRole.permissions.includes(p.name))
                            .map((p) => p.permissionID);

                const currentPermissions = await role.getPermissions();
                const currentPermissionIDs = currentPermissions.map((p) => p.permissionID);

                const permissionsToRevoke = currentPermissions
                    .filter(
                        (p) =>
                            defaultRole.name !== 'Super Admin' && !defaultRole.permissions.includes(p.name)
                    )
                    .map((p) => p.permissionID)
                    .filter((id) => {
                        const isValid = allPermissions.some((perm) => perm.permissionID === id);
                        if (!isValid) {
                            logger.warn(`Invalid permission ID ${id} detected during revocation for role ${defaultRole.name}`);
                        }
                        return isValid;
                    });

                if (permissionsToRevoke.length > 0) {
                    try {
                        await PermissionService.revokePermissionsFromRole(role.roleID, permissionsToRevoke, actorID);
                    } catch (error) {
                        logger.error(`Failed to revoke permissions for role ${defaultRole.name}: ${error.message}, permissions: ${JSON.stringify(permissionsToRevoke)}`);
                    }
                }

                const permissionsToAssign = permissionIDsToAssign
                    .filter((id) => !currentPermissionIDs.includes(id))
                    .filter((id) => {
                        const isValid = allPermissions.some((perm) => perm.permissionID === id);
                        if (!isValid) {
                            logger.warn(`Invalid permission ID ${id} detected during assignment for role ${defaultRole.name}`);
                        }
                        return isValid;
                    });

                if (permissionsToAssign.length > 0) {
                    try {
                        // Use a dummy user object since assignPermissionsToRole requires it
                        const dummyUser = { roles: ['Super Admin'] };
                        await PermissionService.assignPermissionsToRole(dummyUser, role.roleID, permissionsToAssign, actorID);
                    } catch (error) {
                        logger.error(`Failed to assign permissions for role ${defaultRole.name}: ${error.message}, permissions: ${JSON.stringify(permissionsToAssign)}`);
                    }
                }

                results.push({
                    roleName: defaultRole.name,
                    permissionsAssigned: permissionsToAssign.length,
                    permissionsRevoked: permissionsToRevoke.length,
                    keycloakPermissionsSynced: permissionNamesToAssign.length,
                    keycloakPermissionsRemoved: 0, // Will update later
                    totalPermissions:
                        defaultRole.name === 'Super Admin'
                            ? allPermissions.length
                            : permissionIDsToAssign.length,
                });
            }

            // Create or update permissions in Keycloak (one per resource)
            let keycloakPermissionsRemoved = 0;
            for (const permName of allPermissionNames) {
                try {
                    const resourceId = resourceMap.get(permName);
                    if (!resourceId) throw new Error(`Resource not found for permission ${permName}`);

                    const policyIds = permissionToPolicies.get(permName);
                    if (!policyIds || policyIds.length === 0) {
                        logger.debug(`No policies for permission ${permName}, skipping permission creation`);
                        continue;
                    }

                    // Check if permission exists
                    const permissionResponse = await axios.get(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/resource?name=${permName}-permission`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    let permissionId = permissionResponse.data.find((p) => p.name === `${permName}-permission`)?.id;

                    const permissionData = {
                        name: `${permName}-permission`,
                        description: `Permission for ${permName}`,
                        type: 'resource',
                        policies: policyIds,
                        resources: [resourceId],
                        logic: 'POSITIVE',
                        decisionStrategy: 'AFFIRMATIVE',
                    };

                    if (permissionId) {
                        // Update existing permission
                        await axios.put(
                            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/resource/${permissionId}`,
                            permissionData,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                    } else {
                        // Create new permission
                        await axios.post(
                            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/resource`,
                            permissionData,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                    }
                    logger.debug(`Synced permission ${permName}-permission with policies: ${policyIds.join(', ')}`);
                } catch (error) {
                    logger.error(`Failed to create/update permission ${permName}: ${error.message}`);
                    throw new Error(`Could not sync permission ${permName}`);
                }
            }

            // Clean up unused permissions in Keycloak
            const allKeycloakPermissions = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const permissionsToRemove = allKeycloakPermissions.data.filter((p) => {
                if (!p.name || !p.name.endsWith('-permission')) return false;
                const permName = p.name.replace('-permission', '');
                return !allPermissionNames.includes(permName);
            });

            for (const perm of permissionsToRemove) {
                try {
                    await axios.delete(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/${perm.id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    logger.debug(`Removed unused permission ${perm.name}`);
                    keycloakPermissionsRemoved++;
                } catch (error) {
                    logger.error(`Failed to delete permission ${perm.name}: ${error.message}`);
                }
            }

            // Update results with total permissions removed
            results.forEach((result) => {
                result.keycloakPermissionsRemoved = keycloakPermissionsRemoved;
            });

            return results;
        } catch (error) {
            logger.error(`Reset roles error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || 'Could not reset roles.');
        }
    }
}

module.exports = RoleService;