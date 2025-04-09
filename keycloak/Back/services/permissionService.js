const axios = require('axios');
const { Permission, Role, User, UserPermissionOverride } = require('../models');
require('dotenv').config();

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';

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
    static async createPermission(name, className, description) {
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);
        // Create resource in Keycloak
        await axios.post(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource`,
            { name, displayName: description, type: className },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return await Permission.create({ name, class: className, description });
    }

    static async getAllPermissions() {
        return await Permission.findAll();
    }

    static async getPermissionById(permissionID) {
        const perm = await Permission.findByPk(permissionID, {
            include: [{ model: Role, attributes: ['roleID', 'name'] }],
        });
        if (!perm) throw new Error('Permission not found');
        return perm;
    }

    static async updatePermission(permissionID, updates) {
        const perm = await Permission.findByPk(permissionID);
        if (!perm) throw new Error('Permission not found');
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);
        const resource = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource?name=${perm.name}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        await axios.put(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource/${resource.data[0]._id}`,
            { name: updates.name || perm.name, displayName: updates.description || perm.description, type: updates.className || perm.class },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        await perm.update(updates);
        return perm;
    }

    static async deletePermission(permissionID) {
        const perm = await Permission.findByPk(permissionID);
        if (!perm) throw new Error('Permission not found');
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);
        const resource = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource?name=${perm.name}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        await axios.delete(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource/${resource.data[0]._id}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        await perm.destroy();
    }

    static async assignPermissionsToRole(roleID, permissionIDs) {
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);
        const role = await Role.findByPk(roleID);
        if (!role) throw new Error('Role not found');

        const permissions = await Permission.findAll({ where: { permissionID: permissionIDs } });
        if (permissions.length !== permissionIDs.length) throw new Error('One or more permissions not found');

        const rolePolicy = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy/role?name=${role.name}-policy`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const policyId = rolePolicy.data[0]?.id;

        for (const perm of permissions) {
            const resource = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource?name=${perm.name}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const resourceId = resource.data[0]?._id;
            if (!resourceId) continue;

            await axios.post(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/resource`,
                {
                    name: `${perm.name}-permission`,
                    resources: [resourceId],
                    policies: [policyId],
                    decisionStrategy: 'UNANIMOUS',
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        }

        const currentPermissions = await role.getPermissions();
        const currentPermissionIDs = currentPermissions.map(p => p.permissionID);
        const newPermissions = permissions.filter(p => !currentPermissionIDs.includes(p.permissionID));
        if (newPermissions.length > 0) await role.addPermissions(newPermissions);

        return { roleID, assignedPermissions: newPermissions.map(p => p.name), totalAssigned: (await role.getPermissions()).length };
    }

    static async revokePermissionsFromRole(roleID, permissionIDs) {
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);
        const role = await Role.findByPk(roleID);
        if (!role) throw new Error('Role not found');

        const results = [];
        for (const permissionID of permissionIDs) {
            const permission = await Permission.findByPk(permissionID);
            if (!permission) throw new Error(`Permission not found: ${permissionID}`);

            const permissionResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission?name=${permission.name}-permission`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (permissionResponse.data.length) {
                await axios.delete(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission/${permissionResponse.data[0].id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }

            await role.removePermission(permission);
            results.push({
                roleID,
                revokedPermission: permission,
                totalAssigned: (await role.getPermissions()).length,
                message: `Permission ${permissionID} revoked successfully`,
            });
        }

        return results.length === 1 ? results[0] : results;
    }

    static async getPermissionsByRole(roleID) {
        const role = await Role.findByPk(roleID, {
            include: [{ model: Permission, through: { attributes: [] }, attributes: ['permissionID', 'name', 'class', 'description'] }],
        });
        if (!role) throw new Error('Role not found');
        return role.Permissions;
    }

    static async addPermissionOverride(userID, roleID, permissionID, action) {
        const token = await getAdminToken();
        const user = await User.findByPk(userID);
        if (!user) throw new Error('User not found');
        const role = await Role.findByPk(roleID);
        if (!role) throw new Error('Role not found');
        const permission = await Permission.findByPk(permissionID);
        if (!permission) throw new Error('Permission not found');

        const userRoles = await user.getRoles({ where: { roleID } });
        if (!userRoles.length) throw new Error('User does not have this role');

        const [override, created] = await UserPermissionOverride.findOrCreate({
            where: { userID, roleID, permissionID },
            defaults: { action },
        });
        if (!created) await override.update({ action });

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

        return override;
    }

    static async removePermissionOverride(overrideID) {
        const override = await UserPermissionOverride.findByPk(overrideID);
        if (!override) throw new Error('Override not found');
        const token = await getAdminToken();

        const keycloakUser = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${override.userID}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const overrides = JSON.parse(keycloakUser.data.attributes?.permission_overrides || '{}');
        if (overrides[override.roleID]) delete overrides[override.roleID][override.Permission.name];

        await axios.put(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${override.userID}`,
            { attributes: { permission_overrides: JSON.stringify(overrides) } },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        await override.destroy();
        return { message: 'Override removed successfully' };
    }

    static async getEffectivePermissions(userID) {
        const user = await User.findByPk(userID, {
            include: [
                { model: Role, through: { attributes: [] }, include: [{ model: Permission, through: { attributes: [] }, attributes: ['permissionID', 'name', 'class', 'description'] }] },
                { model: UserPermissionOverride, include: [{ model: Permission }] },
            ],
        });
        if (!user) throw new Error('User not found');

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
            if (action === 'revoke') delete rolePermissions[roleID][permissionID];
            else if (action === 'grant') rolePermissions[roleID][permissionID] = override.Permission;
        }

        const effectivePermissions = [];
        for (const roleID in rolePermissions) effectivePermissions.push(...Object.values(rolePermissions[roleID]));
        return effectivePermissions;
    }

    static async getPermissionOverrides(userID) {
        const user = await User.findByPk(userID, {
            include: [{ model: UserPermissionOverride, include: [{ model: Permission }] }],
        });
        if (!user) throw new Error('User not found');
        return user.UserPermissionOverrides;
    }
}

module.exports = PermissionService;