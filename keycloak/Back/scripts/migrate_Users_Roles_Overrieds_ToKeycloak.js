const axios = require('axios');
const { User, Role, Permission, UserPermissionOverride, setupAssociations, sequelize } = require('../models');
require('dotenv').config();

async function getAdminToken() {
    const response = await axios.post(
        `${process.env.KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
        new URLSearchParams({
            grant_type: 'password',
            client_id: 'admin-cli',
            username: process.env.ADMIN_USER,
            password: process.env.ADMIN_PASS,
        })
    );
    return response.data.access_token;
}

async function migrateUser(token, user) {
    try {
        const userCheck = await axios.get(
            `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users?email=${user.email}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        if (userCheck.data.length > 0) {
            console.log(`User ${user.email} already exists in Keycloak, updating keycloakId...`);
            await User.update({ keycloakId: userCheck.data[0].id }, { where: { email: user.email } });
            return userCheck.data[0].id;
        }

        console.warn(`Cannot migrate password for ${user.email}. Setting temporary password; user must reset it.`);
        await axios.post(
            `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users`,
            {
                username: user.email,
                email: user.email,
                firstName: user.firstname,
                lastName: user.lastname,
                enabled: true,
                attributes: { phone: user.phone, wallet: user.wallet },
                credentials: [{ type: 'password', value: 'temporary123', temporary: true }],
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const createdUser = await axios.get(
            `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users?email=${user.email}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const keycloakId = createdUser.data[0].id;
        await User.update({ keycloakId }, { where: { email: user.email } });
        console.log(`Migrated user: ${user.email}`);
        return keycloakId;
    } catch (err) {
        console.error(`Failed to migrate ${user.email}:`, err.response?.data || err.message);
    }
}

async function migrateRole(token, role) {
    try {
        const roleCheck = await axios.get(
            `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/roles/${role.name}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`Role ${role.name} already exists, skipping creation.`);
    } catch (err) {
        if (err.response?.status === 404) {
            await axios.post(
                `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/roles`,
                { name: role.name, description: role.description },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log(`Migrated role: ${role.name}`);
        } else {
            console.error(`Error checking/creating role ${role.name}:`, err.response?.data || err.message);
        }
    }
}

async function assignRoleToUser(token, userEmail, roleName) {
    try {
        const userResponse = await axios.get(
            `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users?email=${userEmail}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!userResponse.data.length) {
            throw new Error(`User with email ${userEmail} not found in Keycloak`);
        }
        const userId = userResponse.data[0].id;

        const roleResponse = await axios.get(
            `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/roles/${roleName}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const roleId = roleResponse.data.id;

        const currentRoles = await axios.get(
            `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users/${userId}/role-mappings/realm`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        if (currentRoles.data.some(r => r.name === roleName)) {
            console.log(`Role ${roleName} already assigned to ${userEmail}, skipping.`);
            return;
        }

        await axios.post(
            `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users/${userId}/role-mappings/realm`,
            [{ id: roleId, name: roleName }],
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`Assigned ${roleName} to ${userEmail}`);
    } catch (err) {
        console.error(`Failed to assign ${roleName} to ${userEmail}:`, err.response?.data || err.message);
    }
}

async function migrateOverrides(token, user) {
    try {
        const overrides = await UserPermissionOverride.findAll({
            where: { userID: user.userID },
            include: [{ model: Permission }],
        });
        if (!overrides.length) {
            console.log(`No overrides found for ${user.email}, skipping.`);
            return;
        }

        const overrideMap = overrides.reduce((acc, o) => {
            acc[o.roleID] = acc[o.roleID] || {};
            acc[o.roleID][o.Permission.name] = o.action; // e.g., "grant" or "revoke"
            return acc;
        }, {});

        const userResponse = await axios.get(
            `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users?email=${user.email}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!userResponse.data.length) {
            console.error(`User ${user.email} not found in Keycloak for overrides`);
            return;
        }
        const userId = userResponse.data[0].id;

        // Update user with permission overrides as a custom attribute
        await axios.put(
            `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users/${userId}`,
            { attributes: { permission_overrides: JSON.stringify(overrideMap) } },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`Migrated overrides for ${user.email}`);
    } catch (err) {
        console.error(`Failed to migrate overrides for ${user.email}:`, err.response?.data || err.message);
    }
}

(async () => {
    try {
        await sequelize.sync();
        setupAssociations();

        const token = await getAdminToken();

        // Migrate users
        const users = await User.findAll();
        for (const user of users) await migrateUser(token, user);

        // Migrate roles
        const roles = await Role.findAll();
        for (const role of roles) await migrateRole(token, role);

        // Assign roles to users
        const userRoles = await User.findAll({
            include: [{
                model: Role,
                through: { attributes: [] }
            }]
        });
        for (const user of userRoles) {
            for (const role of user.Roles) {
                await assignRoleToUser(token, user.email, role.name);
            }
        }

        // Migrate permission overrides
        for (const user of users) await migrateOverrides(token, user);

        console.log('Migration, role assignment, and overrides complete!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await sequelize.close();
    }
})();