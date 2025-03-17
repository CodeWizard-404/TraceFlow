const axios = require('axios');
const { sequelize, User, Role, Permission, setupAssociations } = require('../Back-End/models');
require('dotenv').config(); // Load environment variables

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.KEYCLOAK_REALM || 'TraceFlow';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';

// Initialize associations
setupAssociations();

async function getAdminToken() {
    const response = await axios.post(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
        grant_type: 'password',
        client_id: 'admin-cli',
        username: ADMIN_USER,
        password: ADMIN_PASS,
    }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    return response.data.access_token;
}

async function getClientUuid(token) {
    const headers = { Authorization: `Bearer ${token}` };
    const response = await axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}`, { headers });
    const client = response.data.find(c => c.clientId === CLIENT_ID);
    if (!client) throw new Error(`Client '${CLIENT_ID}' not found in realm '${REALM}'`);
    return client.id; // Return the UUID of the client
}

async function createRoleIfNotExists(token, roleName) {
    const headers = { Authorization: `Bearer ${token}` };
    try {
        const roleResponse = await axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${roleName}`, { headers });
        console.log(`Role '${roleName}' already exists`);
        return roleResponse.data.id;
    } catch (error) {
        if (error.response?.status === 404) {
            const createResponse = await axios.post(`${KEYCLOAK_URL}/admin/realms/${REALM}/roles`, {
                name: roleName,
            }, { headers });
            console.log(`Created role '${roleName}'`);
            const roleResponse = await axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${roleName}`, { headers });
            return roleResponse.data.id;
        } else {
            throw error;
        }
    }
}

async function migratePermissions(token, clientUuid) {
    const permissions = await Permission.findAll();
    const headers = { Authorization: `Bearer ${token}` };
    for (const perm of permissions) {
        try {
            await axios.post(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUuid}/roles`, {
                name: perm.name,
                description: perm.description,
            }, { headers });
            console.log(`Created permission '${perm.name}' as client role`);
        } catch (error) {
            if (error.response?.status === 409) {
                console.log(`Permission '${perm.name}' already exists as client role`);
            } else {
                throw error;
            }
        }
    }
}

async function migrate() {
    try {
        const token = await getAdminToken();
        const headers = { Authorization: `Bearer ${token}` };

        // Get client UUID for traceflow-backend
        const clientUuid = await getClientUuid(token);

        // Migrate permissions first (client roles)
        await migratePermissions(token, clientUuid);

        // Migrate realm roles
        const dbRoles = await Role.findAll();
        const roleMap = new Map();
        for (const role of dbRoles) {
            const roleId = await createRoleIfNotExists(token, role.name);
            roleMap.set(role.name, roleId);
        }

        // Migrate users with their roles
        const users = await User.findAll({
            include: [{
                model: Role,
                through: { attributes: [] },
            }],
        });

        for (const user of users) {
            console.log(`Processing user: ${user.email}`);
            try {
                await axios.post(`${KEYCLOAK_URL}/admin/realms/${REALM}/users`, {
                    username: user.email,
                    email: user.email,
                    firstName: user.firstname,
                    lastName: user.lastname,
                    enabled: true,
                    credentials: [{ type: 'password', value: 'defaultPassword123!', temporary: true }],
                    attributes: {
                        phone: [user.phone || ''],
                        wallet: [user.wallet || ''],
                    },
                }, { headers });
            } catch (error) {
                if (error.response?.status === 409) {
                    console.log(`User '${user.email}' already exists, skipping creation`);
                } else {
                    throw error;
                }
            }

            const keycloakUser = await axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=${user.email}`, { headers });
            const keycloakUserId = keycloakUser.data[0].id;

            const roles = user.Roles.map(role => ({
                id: roleMap.get(role.name),
                name: role.name,
            }));
            if (roles.length > 0) {
                console.log(`Assigning roles to ${user.email}: ${roles.map(r => r.name).join(', ')}`);
                await axios.post(`${KEYCLOAK_URL}/admin/realms/${REALM}/users/${keycloakUserId}/role-mappings/realm`,
                    roles,
                    { headers }
                );
            }
        }

        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error.response ? error.response.data : error.message);
    } finally {
        await sequelize.close();
    }
}

migrate();