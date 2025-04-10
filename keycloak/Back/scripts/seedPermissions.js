const fs = require('fs').promises;
const path = require('path');
const { nanoid } = require('nanoid');
const axios = require('axios');
const { Permission } = require('../models');
const { migratePermissionsKeycloakAssignments } = require('./migratePermissionsKeycloakAssignments');
require('dotenv').config();

// Regular expressions for parsing code
const PERMISSION_REGEX = /requirePermission\(['"`]([^'`"]+)['"`]\)/g;
const ROUTE_PATH_REGEX = /app\.use\(['"`]([^'`"]+)['"`],\s*[a-zA-Z0-9_]+Routes\)/g;
const ROUTE_METHOD_REGEX = /router\.(get|post|put|delete)\(['"`]([^'`"]+)['"`].*requirePermission\(['"`]([^'`"]+)['"`]\)/g;

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

// Extracts permissions with specific route paths
const extractRoutePermissions = async () => {
    const permissionsMap = new Map();
    const appFilePath = path.join(__dirname, '../app.js');
    const appContent = await fs.readFile(appFilePath, 'utf8');
    const routeClasses = new Map();

    [...appContent.matchAll(ROUTE_PATH_REGEX)].forEach(([_, routePath]) => {
        routeClasses.set(routePath, getRouteClass(routePath));
    });

    const directoriesToScan = [path.join(__dirname, '../routes')];
    for (const dir of directoriesToScan) {
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

// Seeds missing permissions into both local DB and Keycloak
const seedMissingPermissions = async () => {
    try {
        const permissionsFromCode = await extractRoutePermissions();
        const existingPermissions = new Set(
            (await Permission.findAll({ attributes: ['name'] })).map(p => p.name)
        );

        const missingPermissions = permissionsFromCode.filter(
            perm => !existingPermissions.has(perm.name)
        );

        if (missingPermissions.length > 0) {
            const permissionObjects = missingPermissions.map(perm => ({
                permissionID: `perm_${nanoid()}`,
                name: perm.name,
                class: perm.class,
                description: `Auto-generated permission for ${perm.name} (Class: ${perm.class})`,
            }));

            await Promise.all(permissionObjects.map(perm =>
                Permission.findOrCreate({
                    where: { name: perm.name },
                    defaults: perm,
                })
            ));
        }

        await migratePermissionsKeycloakAssignments();
    } catch (error) {
        console.error('Error seeding permissions:', error);
        throw error;
    }
};

// Exports
module.exports = {
    extractRoutePermissions,
    seedMissingPermissions,
};

// Execute if run directly
if (require.main === module) {
    const { sequelize } = require('../config/db');
    seedMissingPermissions()
        .then(() => sequelize.close())
        .catch(error => {
            console.error('Script execution failed:', error);
            sequelize.close();
        });
}