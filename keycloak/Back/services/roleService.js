const axios = require('axios');
const { Role, Permission, User } = require('../models');
require('dotenv').config();

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';

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

class RoleService {
    static async createRole(name, description) {
        const token = await getAdminToken();
        await axios.post(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/roles`,
            { name, description },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const [role, created] = await Role.findOrCreate({
            where: { name },
            defaults: { name, description },
        });
        if (!created) throw new Error('Role already exists');
        return role;
    }

    static async getAllRoles() {
        return await Role.findAll({ attributes: ['roleID', 'name', 'description'] });
    }

    static async getRoleById(roleID) {
        const role = await Role.findByPk(roleID, {
            include: [{ model: Permission, through: { attributes: [] }, attributes: ['name', 'description'] }],
        });
        if (!role) throw new Error('Role not found');
        return role;
    }

    static async deleteRole(roleID) {
        const role = await Role.findByPk(roleID);
        if (!role) throw new Error('Role not found');
        const token = await getAdminToken();
        await axios.delete(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        await role.destroy();
        return role;
    }

    static async updateRole(roleID, updates) {
        const role = await Role.findByPk(roleID);
        if (!role) throw new Error('Role not found');
        const token = await getAdminToken();
        await axios.put(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
            { name: updates.name || role.name, description: updates.description || role.description },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        await role.update(updates);
        return role;
    }

    static async assignRolesToUser(userID, roleIDs) {
        const token = await getAdminToken();
        const user = await User.findByPk(userID);
        if (!user) throw new Error('User not found');

        const roles = await Role.findAll({ where: { roleID: roleIDs } });
        if (roles.length !== roleIDs.length) throw new Error('One or more roles not found');

        const currentRoles = await user.getRoles();
        const currentRoleIDs = currentRoles.map(r => r.roleID);
        const newRoles = roles.filter(r => !currentRoleIDs.includes(r.roleID));

        if (newRoles.length > 0) {
            await user.addRoles(newRoles);
            for (const role of newRoles) {
                const roleData = await axios.get(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                await axios.post(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}/role-mappings/realm`,
                    [{ id: roleData.data.id, name: role.name }],
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
        }

        return { userID, assignedRoles: newRoles.map(r => r.name), totalAssigned: (await user.getRoles()).length };
    }

    static async revokeRoleFromUser(userID, roleIDs) {
        const token = await getAdminToken();
        const user = await User.findByPk(userID);
        if (!user) throw new Error('User not found');

        const results = [];
        for (const roleID of roleIDs) {
            const role = await Role.findByPk(roleID);
            if (!role) throw new Error(`Role not found: ${roleID}`);

            const hasRole = await user.hasRole(role);
            if (!hasRole) throw new Error(`User does not have role: ${roleID}`);

            await user.removeRole(role);
            const roleData = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await axios.delete(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}/role-mappings/realm`,
                { data: [{ id: roleData.data.id, name: role.name }], headers: { Authorization: `Bearer ${token}` } }
            );

            results.push({
                userID,
                revokedRole: role,
                totalAssigned: (await user.getRoles()).length,
                message: `Role ${roleID} revoked successfully`,
            });
        }

        return results.length === 1 ? results[0] : results;
    }

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
}

module.exports = RoleService;