// Import required modules
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
const ROUTE_PATH_REGEX = /app\.use\(['"`]([^'`"]+)['"`],\s*[a-zA-Z0-9_]+Routes\)/g;

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

    return Object.entries(routeClassMap)
        .find(([key]) => basePath.includes(key))?.[1] || 'Other';
};

// Extracts permissions and their associated classes from route files

const extractPermissionsFromFiles = async () => {
    const permissionsMap = new Map();

    // Read and parse app.js for route definitions
    const appFilePath = path.join(__dirname, '../app.js');
    const appContent = await fs.readFile(appFilePath, 'utf8');
    const routeClasses = new Map();

    // Extract route paths and their classes
    [...appContent.matchAll(ROUTE_PATH_REGEX)].forEach(([_, routePath]) => {
        routeClasses.set(routePath, getRouteClass(routePath));
    });

    // Scan directories for permission definitions
    for (const dir of DIRECTORIES_TO_SCAN) {
        const files = await fs.readdir(dir);

        await Promise.all(files.map(async (file) => {
            const filePath = path.join(dir, file);
            const stats = await fs.stat(filePath);

            if (stats.isFile() && file.endsWith('.js')) {
                const content = await fs.readFile(filePath, 'utf8');
                const routeName = file.replace('Routes.js', '').toLowerCase();

                // Infer class from route name
                const matchingRoute = Array.from(routeClasses.keys()).find(route => {
                    const routeLower = route.toLowerCase();
                    return routeLower.includes(routeName) ||
                        (routeName.includes('receiptbook') && routeLower.includes('receipt-books')) ||
                        (routeName.includes('receiptstub') && routeLower.includes('receipt-stubs'));
                });

                const inferredClass = matchingRoute ? routeClasses.get(matchingRoute) : 'Other';

                // Extract permissions from file content
                [...content.matchAll(PERMISSION_REGEX)].forEach(([_, permission]) => {
                    if (permission) permissionsMap.set(permission, inferredClass);
                });
            }
        }));
    }

    return Array.from(permissionsMap, ([name, className]) => ({ name, class: className }));
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
            console.log(`${new Date().toISOString()} - No new permissions to seed`);
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

        console.log(`${new Date().toISOString()} - Seeded ${newPermissionsCount} new permissions`);
    } catch (error) {
        console.error('Error seeding permissions:', error);
        throw error;
    }
};

// Exports
module.exports = {
    extractPermissionsFromFiles,
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