const axios = require('axios');
const { User, Role, setupAssociations, sequelize } = require('../models');
const crypto = require('crypto');
require('dotenv').config();

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const KEYCLOAK_ADMIN_USER = process.env.KEYCLOAK_ADMIN_USER || 'admin';
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';

async function getAdminToken() {
    const response = await axios.post(
        `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
        new URLSearchParams({
            grant_type: 'password',
            client_id: 'admin-cli',
            username: KEYCLOAK_ADMIN_USER,
            password: KEYCLOAK_ADMIN_PASSWORD,
        })
    );
    return response.data.access_token;
}

async function migrateUser(token, user) {
    const userCheck = await axios.get(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/users?email=${user.email}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    if (userCheck.data.length > 0) {
        await User.update({ keycloakId: userCheck.data[0].id }, { where: { email: user.email } });
        console.log(`${new Date().toISOString()} - User ${user.email} already exists, updated keycloakId`);
        return userCheck.data[0].id;
    }

    const tempPassword = crypto.randomBytes(8).toString('hex'); // Random 16-char password
    await axios.post(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/users`,
        {
            username: user.email,
            email: user.email,
            firstName: user.firstname,
            lastName: user.lastname,
            enabled: true,
            attributes: {
                phone: user.phone || '', // Phone moved to attributes
            },
            credentials: [{ type: 'password', value: tempPassword, temporary: true }],
        },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const createdUser = await axios.get(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/users?email=${user.email}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const keycloakId = createdUser.data[0].id;
    await User.update({ keycloakId }, { where: { email: user.email } });
    console.log(`${new Date().toISOString()} - Migrated user: ${user.email} (temp password: ${tempPassword})`);
    return keycloakId;
}

async function migrateRole(token, role) {
    try {
        const roleCheck = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        await Role.update({ keycloakId: roleCheck.data.id }, { where: { name: role.name } });
        console.log(`${new Date().toISOString()} - Role ${role.name} exists, updated keycloakId`);
        return roleCheck.data.id;
    } catch (err) {
        if (err.response?.status === 404) {
            await axios.post(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/roles`,
                { name: role.name, description: role.description || `Role: ${role.name}` },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const newRole = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await Role.update({ keycloakId: newRole.data.id }, { where: { name: role.name } });
            console.log(`${new Date().toISOString()} - Migrated role: ${role.name}`);
            return newRole.data.id;
        }
        throw new Error(`Error checking/creating role ${role.name}: ${err.response?.data || err.message}`);
    }
}

async function assignRoleToUser(token, userEmail, roleName, roleId) {
    const userResponse = await axios.get(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/users?email=${userEmail}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!userResponse.data.length) throw new Error(`User ${userEmail} not found in Keycloak`);
    const userId = userResponse.data[0].id;

    const currentRoles = await axios.get(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userId}/role-mappings/realm`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    if (currentRoles.data.some(r => r.name === roleName)) {
        console.log(`${new Date().toISOString()} - Role ${roleName} already assigned to ${userEmail}`);
        return;
    }

    await axios.post(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userId}/role-mappings/realm`,
        [{ id: roleId, name: roleName }],
        { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log(`${new Date().toISOString()} - Assigned ${roleName} to ${userEmail}`);
}

async function migrateToKeycloak() {
    try {
        await sequelize.sync();
        setupAssociations();
        const token = await getAdminToken();

        // Optional: Clean Keycloak (uncomment if needed)
        /*
        const allUsers = await axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM}/users`, { headers: { Authorization: `Bearer ${token}` } });
        await Promise.all(allUsers.data.map(u => axios.delete(`${KEYCLOAK_URL}/admin/realms/${REALM}/users/${u.id}`, { headers: { Authorization: `Bearer ${token}` } })));
        const allRoles = await axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM}/roles`, { headers: { Authorization: `Bearer ${token}` } });
        await Promise.all(allRoles.data.filter(r => !['uma_authorization', 'offline_access', 'default-roles-traceflow'].includes(r.name)).map(r => axios.delete(`${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${r.name}`, { headers: { Authorization: `Bearer ${token}` } })));
        console.log(`${new Date().toISOString()} - Cleared Keycloak users and roles`);
        */

        // Migrate users
        const users = await User.findAll();
        for (const user of users) {
            await migrateUser(token, user);
        }

        // Migrate roles
        const roles = await Role.findAll();
        const roleMap = new Map();
        for (const role of roles) {
            const keycloakId = await migrateRole(token, role);
            roleMap.set(role.name, { ...role.dataValues, keycloakId });
        }

        // Assign roles to users
        const userRoles = await User.findAll({
            include: [{ model: Role, through: { attributes: [] } }],
        });
        for (const user of userRoles) {
            for (const role of user.Roles) {
                const roleInfo = roleMap.get(role.name);
                if (roleInfo) {
                    await assignRoleToUser(token, user.email, role.name, roleInfo.keycloakId);
                }
            }
        }

        console.log(`${new Date().toISOString()} - Migration and role assignment complete`);
    } catch (err) {
        console.error(`${new Date().toISOString()} - Migration failed:`, err);
        throw err; // Ensure error propagates
    } finally {
        await sequelize.close();
    }
}

module.exports = { migrateToKeycloak };