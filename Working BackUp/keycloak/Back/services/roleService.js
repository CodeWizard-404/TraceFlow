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

// Rest of RoleService remains unchanged...
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

            logger.info(`Role ${name} created by user ${actorID}`, { ip: null });
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

            logger.info(`Role ${roleID} updated by user ${actorID}`, { ip: null });
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

            logger.info(`Role ${roleID} deleted by user ${actorID}`, { ip: null });
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

            logger.info(`Assigned ${newRoles.length} roles to user ${userID} by ${actorID}`, { ip: null });
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

            logger.info(`Revoked ${results.length} roles from user ${userID} by ${actorID}`, { ip: null });
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
                    description: 'Full administrative privileges',
                    permissions: [], //All
                },
                {
                    name: 'Admin',
                    description: 'Manage users',
                    permissions: [
                        // Class: Checklist
                        'access_checklist_item_details',
                        'access_checklists_items',
                        'create_checklists_items',
                        'delete_checklists_items',
                        'update_checklists_items',
                        // Class: Permission
                        'access_all_permissions',
                        'access_permission_details',
                        'access_permissions_by_role',
                        'assign_permissions',
                        'create_permission_overrides',
                        'delete_permission_overrides',
                        'revoke_permissions',
                        // Class: Reason
                        'access_reason_item_details',
                        'access_reason_items',
                        'create_reason_items',
                        'delete_reason_items',
                        'update_reason_items',
                        // Class: Role
                        'access_all_roles',
                        'assign_roles',
                        'create_roles',
                        'delete_roles',
                        'read_role_details',
                        'reset_roles',
                        'revoke_roles',
                        'update_roles',
                        // Class: User
                        'access_all_users',
                        'access_managers',
                        'access_supervisors',
                        'access_user_by_phone',
                        'access_user_details',
                        'access_users_by_role',
                        'assign_supervisors',
                        'create_users',
                        'delete_users',
                        'revoke_supervisors',
                        'update_users'
                    ],
                },
                {
                    name: 'Supervisor',
                    description: 'Log visits',
                    permissions: [
                        // Class: Agent
                        'access_agents_by_id',
                        'access_agents_by_location',
                        'access_agents_by_phone',
                        'access_agents_locations',
                        // Class: Checklist
                        'access_checklist_item_details',
                        'access_checklists_items',
                        'access_visit_checklist',
                        // Class: Reason
                        'access_reason_item_details',
                        'access_reason_items',
                        'access_visit_reasons',
                        // Class: ReceiptBook
                        'access_all_receipt_books',
                        'access_receipt_book_details',
                        'access_receipt_books_by_holder',
                        'access_receipt_books_by_number',
                        'collect_supplier_receipt_books',
                        'transfer_receipt_books',
                        'validate_receipt_books_transfer',
                        // Class: ReceiptStub
                        'collect_receipt_stubs',
                        'validate_receipt_stubs',
                        // Class: Timesheet
                        'access_supervisor_timesheets',
                        'access_timesheet_details',
                        'create_self_timesheets',
                        // Class: User
                        'access_all_users',
                        'access_managers',
                        'access_user_by_phone',
                        'access_user_details',
                        'access_users_by_role',
                        // Class: Visit
                        'access_visit_details',
                        'delete_visit',
                        'edit_visit_details',
                        'log_visits',
                        'scan_visits'
                    ],
                },
                {
                    name: 'Manager',
                    description: 'Manage supervisors',
                    permissions: [
                        // Class: Agent
                        'access_agents_by_id',
                        'access_agents_by_location',
                        'access_agents_by_phone',
                        'access_agents_locations',
                        // Class: Checklist
                        'access_checklist_item_details',
                        'access_checklists_items',
                        'access_visit_checklist',
                        // Class: Reason
                        'access_reason_item_details',
                        'access_reason_items',
                        'access_visit_reasons',
                        // Class: Timesheet
                        'access_supervisor_timesheets',
                        'access_timesheet_details',
                        'create_timesheets_for_supervisor',
                        'validate_timesheets',
                        // Class: User
                        'access_all_users',
                        'access_supervisors',
                        'access_user_by_phone',
                        'access_user_details',
                        'access_users_by_role',
                        // Class: Visit
                        'access_visit_details',
                        'delete_visit',
                        'edit_visit_details'
                    ],
                },
                {
                    name: 'Stock Manager',
                    description: 'Archive stock',
                    permissions: [
                        // Class: Agent
                        'access_agents_by_id',
                        'access_agents_by_location',
                        'access_agents_by_phone',
                        'access_agents_locations',
                        // Class: ReceiptBook
                        'access_all_receipt_books',
                        'access_receipt_book_details',
                        'access_receipt_book_history',
                        'access_receipt_books_by_holder',
                        'access_receipt_books_by_number',
                        'delete_receipt_books',
                        'transfer_receipt_books',
                        'update_receipt_books',
                        'validate_receipt_books_transfer',
                        // Class: ReceiptStub
                        'archive_receipt_stubs',
                        // Class: User
                        'access_all_users',
                        'access_user_by_phone',
                        'access_user_details',
                        'access_users_by_role'
                    ],
                },
                {
                    name: 'Regional Manager',
                    description: 'Manage books',
                    permissions: [
                        // Class: Agent
                        'access_agents_by_id',
                        'access_agents_by_location',
                        'access_agents_by_phone',
                        'access_agents_locations',
                        // Class: ReceiptBook
                        'access_all_receipt_books',
                        'access_receipt_book_details',
                        'access_receipt_book_history',
                        'access_receipt_books_by_holder',
                        'access_receipt_books_by_number',
                        'transfer_receipt_books',
                        'validate_receipt_books_transfer',
                        // Class: User
                        'access_all_users',
                        'access_user_by_phone',
                        'access_user_details',
                        'access_users_by_role'
                    ],
                },
                {
                    name: 'Purchase Team',
                    description: 'Manage initial stock',
                    permissions: [
                        // Class: Agent
                        'access_agents_by_id',
                        'access_agents_by_location',
                        'access_agents_by_phone',
                        'access_agents_locations',
                        // Class: ReceiptBook
                        'access_all_receipt_books',
                        'access_receipt_book_details',
                        'access_receipt_book_history',
                        'access_receipt_books_by_holder',
                        'access_receipt_books_by_number',
                        'collect_supplier_receipt_books',
                        'create_receipt_books',
                        'delete_receipt_books',
                        'send_receipt_books',
                        'transfer_receipt_books',
                        'update_receipt_books',
                        'validate_receipt_books_transfer',
                        // Class: User
                        'access_all_users',
                        'access_user_by_phone',
                        'access_user_details',
                        'access_users_by_role'
                    ],
                }
            ];

            const results = [];

            // Get all permissions from local DB
            const allPermissions = await Permission.findAll();
            const allPermissionNames = allPermissions.map((p) => p.name);

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
                    .map((p) => p.permissionID);
                if (permissionsToRevoke.length > 0) {
                    await PermissionService.revokePermissionsFromRole(role.roleID, permissionsToRevoke);
                }

                const permissionsToAssign = permissionIDsToAssign.filter(
                    (id) => !currentPermissionIDs.includes(id)
                );
                if (permissionsToAssign.length > 0) {
                    await PermissionService.assignPermissionsToRole(role.roleID, permissionsToAssign);
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

            logger.info(`Reset main roles by user ${actorID}`, { ip: null });
            return results;
        } catch (error) {
            logger.error(`Reset roles error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || 'Could not reset roles.');
        }
    }
}

module.exports = RoleService;