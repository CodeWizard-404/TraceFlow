const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { Permission } = require('../models');
require('dotenv').config();

// Configuration constants
const DIRECTORIES_TO_SCAN = [path.join(__dirname, '../routes')];
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';

// Regular expressions for parsing code
const PERMISSION_REGEX = /requirePermission\(['"`]([^'`"]+)['"`]\)/g;
const ROUTE_PATH_REGEX = /app\.use\(['"`]([^'`"]+)['"`],\s*[a-zA-Z0-9_]+Routes\)/g;
const ROUTE_METHOD_REGEX = /router\.(get|post|put|delete)\(['"`]([^'`"]+)['"`].*requirePermission\(['"`]([^'`"]+)['"`]\)/g;

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
};

// Determines the class type based on route path
const getRouteClass = (routePath) => {
    const basePath = routePath.toLowerCase().replace('/api/', '');
    const routeClassMap = {
        timesheets: 'Timesheet',
        visits: 'Visit',
        agents: 'Agent',
        checklists: 'Checklist',
        reasons: 'Reason',
        'receipt-books': 'ReceiptBook',
        'receipt-stubs': 'ReceiptStub',
        auth: 'User',
        roles: 'Role',
        permissions: 'Permission',
        users: 'User',
    };
    return Object.entries(routeClassMap).find(([key]) => basePath.includes(key))?.[1] || 'Other';
};

// Extracts permissions with specific route paths from codebase
const extractRoutePermissions = async () => {
    const permissionsMap = new Map();
    const appFilePath = path.join(__dirname, '../app.js');
    const appContent = await fs.readFile(appFilePath, 'utf8');
    const routeClasses = new Map();

    [...appContent.matchAll(ROUTE_PATH_REGEX)].forEach(([_, routePath]) => {
        routeClasses.set(routePath, getRouteClass(routePath));
    });

    for (const dir of DIRECTORIES_TO_SCAN) {
        const files = await fs.readdir(dir);
        await Promise.all(files.map(async (file) => {
            const filePath = path.join(dir, file);
            const stats = await fs.stat(filePath);

            if (stats.isFile() && file.endsWith('.js')) {
                const content = await fs.readFile(filePath, 'utf8');
                const routeName = file.replace('Routes.js', '').toLowerCase();
                const matchingRoute = Array.from(routeClasses.keys()).find(route => {
                    const routeLower = route.toLowerCase();
                    return routeLower.includes(routeName) ||
                        (routeName.includes('receiptbook') && routeLower.includes('receipt-books')) ||
                        (routeName.includes('receiptstub') && routeLower.includes('receipt-stubs'));
                });

                const baseRoute = matchingRoute || '/api/unknown';
                const inferredClass = routeClasses.get(matchingRoute) || 'Other';

                [...content.matchAll(ROUTE_METHOD_REGEX)].forEach(([_, method, routePath, permission]) => {
                    if (permission) {
                        const fullRoute = path.join(baseRoute, routePath).replace(/\\/g, '/');
                        permissionsMap.set(permission, { name: permission, class: inferredClass, route: fullRoute });
                    }
                });
            }
        }));
    }
    return Array.from(permissionsMap.values());
};

// Get Keycloak admin token
async function getAdminToken() {
    const response = await axios.post(
        `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
        new URLSearchParams({
            grant_type: 'password',
            client_id: 'admin-cli',
            username: process.env.KEYCLOAK_KEYCLOAK_ADMIN_USER || 'admin',
            password: process.env.KEYCLOAK_KEYCLOAK_ADMIN_PASSWORDWORD || 'admin',
        })
    );
    return response.data.access_token;
}

// Fetch client UUID
async function getClientUUID(token) {
    const response = await axios.get(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const client = response.data.find(c => c.clientId === CLIENT_ID);
    if (!client) throw new Error(`Client ${CLIENT_ID} not found`);
    return client.id;
}

// Fetch all Keycloak data
async function fetchKeycloakData(token, clientUUID) {
    const [resources, permissions, policies, roles, users] = await Promise.all([
        axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource`, {
            headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/permission`, {
            headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/policy`, {
            headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM}/roles`, {
            headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM}/users`, {
            headers: { Authorization: `Bearer ${token}` },
        }),
    ]);

    return {
        resources: resources.data,
        permissions: permissions.data,
        policies: policies.data,
        roles: roles.data,
        users: users.data,
    };
}

// Sync resources from codebase to Keycloak (create or update, no deletions)
async function syncResourcesToKeycloak(token, clientUUID, codePermissions) {
    const existingResources = new Map(
        (await axios.get(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource`, {
            headers: { Authorization: `Bearer ${token}` },
        })).data.map(r => [r.name, r])
    );

    for (const perm of codePermissions) {
        const resourceName = perm.name;
        const scope = getScopeFromPermissionName(perm.name);
        const existingResource = existingResources.get(resourceName);

        if (!existingResource) {
            await axios.post(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource`,
                {
                    name: resourceName,
                    type: 'urn:traceflow:resources:route',
                    uris: [perm.route || '/api/unknown'],
                    scopes: [{ name: scope }],
                    attributes: { class: perm.class },
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log(`${colors.green}Created resource: ${resourceName}${colors.reset}`);
        } else {
            const needsUpdate =
                existingResource.uris[0] !== (perm.route || '/api/unknown') ||
                !existingResource.scopes.some(s => s.name === scope) ||
                existingResource.attributes.class !== perm.class;

            if (needsUpdate) {
                await axios.put(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${clientUUID}/authz/resource-server/resource/${existingResource._id}`,
                    {
                        name: resourceName,
                        type: 'urn:traceflow:resources:route',
                        uris: [perm.route || '/api/unknown'],
                        scopes: existingResource.scopes.some(s => s.name === scope) ? existingResource.scopes : [...existingResource.scopes, { name: scope }],
                        attributes: { class: perm.class },
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log(`${colors.yellow}Updated resource: ${resourceName}${colors.reset}`);
            }
        }
    }
}

// Determine scope from permission name
function getScopeFromPermissionName(permissionName) {
    if (permissionName.includes('access') || permissionName.includes('read') || permissionName.includes('get')) return 'read';
    if (permissionName.includes('create') || permissionName.includes('post')) return 'write';
    if (permissionName.includes('update') || permissionName.includes('put')) return 'update';
    if (permissionName.includes('delete')) return 'delete';
    return 'access';
}

// Main function to list and sync
async function listAndSyncKeycloak() {
    try {
        console.log(`${colors.cyan}=== Starting Keycloak Sync and List ===${colors.reset}`);
        const token = await getAdminToken();
        const clientUUID = await getClientUUID(token);

        // Fetch existing Keycloak data
        const { resources, permissions, policies, roles, users } = await fetchKeycloakData(token, clientUUID);

        // List existing data
        console.log(`\n${colors.cyan}Resources (${resources.length}):${colors.reset}`);
        resources.forEach(r => console.log(`  - ${r.name} (URI: ${r.uris[0]}, Scopes: ${r.scopes.map(s => s.name).join(', ')})`));

        console.log(`\n${colors.cyan}Permissions (${permissions.length}):${colors.reset}`);
        permissions.forEach(p => console.log(`  - ${p.name} (Resources: ${p.resources?.join(', ') || 'N/A'}, Policies: ${p.policies?.join(', ') || 'N/A'})`));

        console.log(`\n${colors.cyan}Policies (${policies.length}):${colors.reset}`);
        policies.forEach(p => console.log(`  - ${p.name} (Type: ${p.type}, Description: ${p.description || 'N/A'})`));

        console.log(`\n${colors.cyan}Roles (${roles.length}):${colors.reset}`);
        roles.forEach(r => console.log(`  - ${r.name} (Description: ${r.description || 'N/A'})`));

        console.log(`\n${colors.cyan}Users (${users.length}):${colors.reset}`);
        users.forEach(u => console.log(`  - ${u.email || u.username} (ID: ${u.id})`));

        // Extract permissions from codebase
        const codePermissions = await extractRoutePermissions();
        console.log(`\n${colors.cyan}Permissions in Codebase (${codePermissions.length}):${colors.reset}`);
        codePermissions.forEach(p => console.log(`  - ${p.name} (Class: ${p.class}, Route: ${p.route})`));

        // Sync resources from codebase to Keycloak (create/update only)
        await syncResourcesToKeycloak(token, clientUUID, codePermissions);

        console.log(`\n${colors.cyan}=== Sync and List Complete ===${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}Error during sync and list:${colors.reset}`, error.message);
        process.exit(1);
    }
}

// Run the script
listAndSyncKeycloak();