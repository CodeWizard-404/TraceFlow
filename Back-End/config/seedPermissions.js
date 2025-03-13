const fs = require('fs').promises;
const path = require('path');
const { nanoid } = require('nanoid');
const { Permission } = require('../models');
require('dotenv').config();

const directoriesToScan = [
    path.join(__dirname, '../routes'),
    path.join(__dirname, '../controllers'),
];

const permissionRegex = /requirePermission\(['"`]([^'`"]+)['"`]\)/g;
const routePathRegex = /app\.use\(['"`]([^'`"]+)['"`],\s*[a-zA-Z0-9_]+Routes\)/g;

// Maps route paths to their respective classes
const getRouteClass = (routePath) => {
    const basePath = routePath.toLowerCase().replace('/api/', '');
    if (basePath.includes('timesheets')) return 'Timesheet';
    if (basePath.includes('visits')) return 'Visit';
    if (basePath.includes('agents')) return 'Agent';
    if (basePath.includes('checklists')) return 'Checklist';
    if (basePath.includes('reasons')) return 'Reason';
    if (basePath.includes('receipt-books')) return 'ReceiptBook'; 
    if (basePath.includes('receipt-stubs')) return 'ReceiptStub'; 
    if (basePath.includes('auth')) return 'User';
    if (basePath.includes('roles')) return 'Role';
    if (basePath.includes('permissions')) return 'Permission';
    if (basePath.includes('users')) return 'User';
    return 'User'; // Fallback default
};

// Extracts permissions and their associated route classes
async function extractPermissionsFromFiles() {
    const permissionsMap = new Map();

    console.log(`${new Date().toISOString()} - Starting permission extraction from files...`);

    // Step 1: Get route paths from app.js
    const appFilePath = path.join(__dirname, '../app.js');
    console.log(`${new Date().toISOString()} - Reading app.js to extract route paths: ${appFilePath}`);
    const appContent = await fs.readFile(appFilePath, 'utf8');
    const routeClasses = new Map();
    let routeMatch;

    while ((routeMatch = routePathRegex.exec(appContent)) !== null) {
        const routePath = routeMatch[1];
        const routeClass = getRouteClass(routePath);
        routeClasses.set(routePath, routeClass);
        console.log(`${new Date().toISOString()} - Found route: ${routePath} (Class: ${routeClass})`);
    }

    // Step 2: Scan route files for permissions
    for (const dir of directoriesToScan) {
        console.log(`${new Date().toISOString()} - Scanning directory: ${dir}`);
        const files = await fs.readdir(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = await fs.stat(filePath);

            if (stats.isFile() && file.endsWith('.js')) {
                console.log(`${new Date().toISOString()} - Reading file: ${filePath}`);
                const content = await fs.readFile(filePath, 'utf8');
                let permMatch;

                // Determine the class based on the route file’s corresponding app.js route
                let inferredClass = 'User'; // Default for controllers
                if (dir.includes('routes')) {
                    const routeName = file.replace('Routes.js', '').toLowerCase();
                    const matchingRoute = Array.from(routeClasses.keys()).find(route => 
                        route.toLowerCase().includes(routeName) || // Direct match
                        (routeName.includes('receiptbook') && route.includes('receipt-books')) || // Handle receiptBook -> receipt-books
                        (routeName.includes('receiptstub') && route.includes('receipt-stubs'))   // Handle receiptStub -> receipt-stubs
                    );
                    if (matchingRoute) {
                        inferredClass = routeClasses.get(matchingRoute);
                        console.log(`${new Date().toISOString()} - Assigned class ${inferredClass} to ${file} based on route ${matchingRoute}`);
                    } else {
                        console.warn(`${new Date().toISOString()} - No matching route found for ${file}, defaulting to 'User'`);
                    }
                }

                while ((permMatch = permissionRegex.exec(content)) !== null) {
                    const permission = permMatch[1];
                    if (permission) {
                        console.log(`${new Date().toISOString()} - Found permission: ${permission} in ${filePath}`);
                        permissionsMap.set(permission, inferredClass);
                    }
                }
            }
        }
    }

    const permissions = Array.from(permissionsMap.entries()).map(([name, permClass]) => ({ name, class: permClass }));
    console.log(`${new Date().toISOString()} - Extracted ${permissions.length} permissions from files`);
    return permissions;
}

// Seeds missing permissions into the database with class assignment
async function seedMissingPermissions() {
    try {
        console.log(`${new Date().toISOString()} - Starting permission seeding process...`);
        const permissionsWithClasses = await extractPermissionsFromFiles();

        console.log(`${new Date().toISOString()} - Fetching existing permissions from database...`);
        const existingPermissions = await Permission.findAll({
            attributes: ['name'],
        }).then(perms => perms.map(p => p.name));
        console.log(`${new Date().toISOString()} - Found ${existingPermissions.length} existing permissions`);

        const missingPermissions = permissionsWithClasses.filter(
            perm => !existingPermissions.includes(perm.name)
        );
        console.log(`${new Date().toISOString()} - Identified ${missingPermissions.length} missing permissions`);

        if (missingPermissions.length > 0) {
            console.log(`${new Date().toISOString()} - Preparing to seed ${missingPermissions.length} missing permissions...`);
            const permissionObjects = missingPermissions.map(perm => ({
                permissionID: `perm_${nanoid()}`,
                name: perm.name,
                type: perm.name.startsWith('access_') ? 'page' : 'feature',
                class: perm.class,
                description: `Auto-generated permission for ${perm.name} (Class: ${perm.class})`,
            }));

            let newPermissions = 0;
            for (const perm of permissionObjects) {
                const [instance, created] = await Permission.findOrCreate({
                    where: { name: perm.name },
                    defaults: perm,
                });
                if (created) {
                    console.log(`${new Date().toISOString()} - Seeding new permission: ${perm.name} (Class: ${perm.class})`);
                    newPermissions++;
                }
            }
            console.log(`${new Date().toISOString()} - Successfully seeded ${newPermissions} new permissions`);
        } else {
            console.log(`${new Date().toISOString()} - No new permissions to seed; all permissions already exist`);
        }
    } catch (error) {
        console.error(`${new Date().toISOString()} - Error seeding permissions:`, error);
        throw error;
    }
}

module.exports = { extractPermissionsFromFiles, seedMissingPermissions };

if (require.main === module) {
    const { sequelize } = require('../config/db');
    seedMissingPermissions().then(() => {
        console.log(`${new Date().toISOString()} - Closing database connection after manual seeding...`);
        sequelize.close();
    });
}