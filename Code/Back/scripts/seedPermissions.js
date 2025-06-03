const fs = require('fs').promises;
const path = require('path');
const { nanoid } = require('nanoid');
const { Permission } = require('../models');
require('dotenv').config();

// Configuration constants
const DIRECTORIES_TO_SCAN = [
    path.join(__dirname, '../routes'),
];

// Regular expressions for parsing code
const PERMISSION_REGEX = /requirePermission\(['"`]([^'`"]+)['"`]\)/g;
const ROUTE_PATH_REGEX = /app\.use\(['"`]([^'`"]+)['"`],\s*(?:[a-zA-Z0-9_]+,\s*)*[a-zA-Z0-9_]+Routes\)/g;
const ROUTER_METHOD_REGEX = /router\.(get|post|put|delete)\(['"`]([^'`"]+)['"`],\s*(?:[^)]*,\s*)*requirePermission\(['"`]([^'`"]+)['"`]\)\s*(?:,\s*[^)]+)*\)/g;

// Determines the class type based on route path
const getRouteClass = (routePath) => {
    const basePath = routePath.toLowerCase().replace('/api/', '');
    const routeClassMap = {
        notifications: 'Notification',
        timesheets: 'Timesheet',
        visits: 'Visit',
        agents: 'Agent',
        checklists: 'Checklist',
        reasons: 'Reason',
        'receipt-books': 'ReceiptBook',
        'receipt-stubs': 'ReceiptStub',
        auth: 'Auth',
        roles: 'Role',
        permissions: 'Permission',
        users: 'User',
        locations: 'Location',
        'csv-headers': 'CSVHeader',
        ai: 'AI',
        logs: 'Log',
        reports: 'Report',
        csv: 'CSV'
    };

    return Object.entries(routeClassMap)
        .find(([key]) => basePath.includes(key))?.[1] || 'Other';
};

// Extracts permissions and their associated classes and routes from route files
const extractPermissionsFromFiles = async () => {
    const permissionsMap = new Map();

    // Read and parse route definitions from config/routes.js
    const routesFilePath = path.join(__dirname, '../config/routes.js');
    let routeClasses = new Map();
    let routeBasePaths = new Map();
    try {
        const routesContent = await fs.readFile(routesFilePath, 'utf8');
        [...routesContent.matchAll(ROUTE_PATH_REGEX)].forEach(([_, routePath]) => {
            routeClasses.set(routePath, getRouteClass(routePath));
            routeBasePaths.set(routePath.toLowerCase(), routePath);
        });
    } catch (error) {
        throw error;
    }

    // Scan directories for permission definitions
    for (const dir of DIRECTORIES_TO_SCAN) {
        const files = await fs.readdir(dir);

        await Promise.all(files.map(async (file) => {
            const filePath = path.join(dir, file);
            const stats = await fs.stat(filePath);

            if (stats.isFile() && file.endsWith('.js')) {
                const content = await fs.readFile(filePath, 'utf8');
                const routeName = file.replace('Routes.js', '').toLowerCase();

                // Find matching route
                const matchingRoute = Array.from(routeClasses.keys()).find(route => {
                    const routeLower = route.toLowerCase();
                    return routeLower.includes(routeName) ||
                        (routeName.includes('receiptbook') && routeLower.includes('receipt-books')) ||
                        (routeName.includes('receiptstub') && routeLower.includes('receipt-stubs')) ||
                        (routeName.includes('csvheader') && routeLower.includes('csv-headers')) ||
                        (routeName === 'notification' && routeLower.includes('notifications')) ||
                        (routeName === 'system' && routeLower.includes('logs')) ||
                        (routeName === 'report' && routeLower.includes('reports'));
                });

                const inferredClass = matchingRoute ? routeClasses.get(matchingRoute) : 'Other';
                const basePath = matchingRoute ? routeBasePaths.get(matchingRoute.toLowerCase()) : '/api/unknown';

                // Extract permissions with specific routes
                [...content.matchAll(ROUTER_METHOD_REGEX)].forEach(([_, method, routePath, permission]) => {
                    if (permission) {
                        // Construct full URI
                        const fullRoute = routePath.startsWith('/')
                            ? `${basePath}${routePath}`
                            : `${basePath}/${routePath}`;
                        permissionsMap.set(permission, { class: inferredClass, route: fullRoute });
                    }
                });

                // Fallback for permissions not tied to specific routes
                [...content.matchAll(PERMISSION_REGEX)].forEach(([_, permission]) => {
                    if (permission && !permissionsMap.has(permission)) {
                        permissionsMap.set(permission, { class: inferredClass, route: basePath });
                    }
                });
            }
        }));
    }

    return Array.from(permissionsMap, ([name, data]) => ({
        name,
        class: data.class,
        route: data.route,
    }));
};

// Seeds missing permissions into the database
const seedMissingPermissions = async () => {
    try {
        const permissionsWithClasses = await extractPermissionsFromFiles();
        const existingPermissions = new Set(
            (await Permission.findAll({ attributes: ['name'] })).map(p => p.name)
        );

        const missingPermissions = permissionsWithClasses.filter(
            perm => !existingPermissions.has(perm.name)
        );

        if (missingPermissions.length === 0) {
            return;
        }

        // Prepare permission objects for database insertion
        const permissionObjects = missingPermissions.map(perm => ({
            permissionID: `perm_${nanoid()}`,
            name: perm.name,
            class: perm.class,
            description: `Auto-generated permission for ${perm.name} (Class: ${perm.class})`,
        }));

        // Seed permissions and count new additions
        let newPermissionsCount = 0;
        await Promise.all(permissionObjects.map(async (perm) => {
            const [_, created] = await Permission.findOrCreate({
                where: { name: perm.name },
                defaults: perm,
            });
            if (created) newPermissionsCount++;
        }));

        // Dynamically import migrateRe.js to avoid circular dependency
        const { migratePermissionsToKeycloak } = require('./migrateRe');
        await migratePermissionsToKeycloak();
    } catch (error) {
        throw error;
    }
};

// Adapts permissions for Keycloak resource migration
const extractRoutePermissions = async () => {
    try {
        // Reuse existing permissions extraction logic
        const permissions = await extractPermissionsFromFiles();
        return permissions;
    } catch (error) {
        throw error;
    }
};

// Export functions
module.exports = {
    extractPermissionsFromFiles,
    seedMissingPermissions,
    extractRoutePermissions,
};

// Execute if run directly
if (require.main === module) {
    const { sequelize } = require('../config/db');
    seedMissingPermissions()
        .then(() => sequelize.close())
        .catch(error => {
            sequelize.close();
        });
}