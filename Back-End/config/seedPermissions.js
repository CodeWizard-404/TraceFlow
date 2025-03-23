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
    return 'User';
};

async function extractPermissionsFromFiles() {
    const permissionsMap = new Map();
    const appFilePath = path.join(__dirname, '../app.js');
    const appContent = await fs.readFile(appFilePath, 'utf8');
    const routeClasses = new Map();
    let routeMatch;

    while ((routeMatch = routePathRegex.exec(appContent)) !== null) {
        const routePath = routeMatch[1];
        routeClasses.set(routePath, getRouteClass(routePath));
    }

    for (const dir of directoriesToScan) {
        const files = await fs.readdir(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = await fs.stat(filePath);
            if (stats.isFile() && file.endsWith('.js')) {
                const content = await fs.readFile(filePath, 'utf8');
                let inferredClass = 'User';
                if (dir.includes('routes')) {
                    const routeName = file.replace('Routes.js', '').toLowerCase();
                    const matchingRoute = Array.from(routeClasses.keys()).find(route => 
                        route.toLowerCase().includes(routeName) ||
                        (routeName.includes('receiptbook') && route.includes('receipt-books')) ||
                        (routeName.includes('receiptstub') && route.includes('receipt-stubs'))
                    );
                    if (matchingRoute) inferredClass = routeClasses.get(matchingRoute);
                }
                let permMatch;
                while ((permMatch = permissionRegex.exec(content)) !== null) {
                    const permission = permMatch[1];
                    if (permission) permissionsMap.set(permission, inferredClass);
                }
            }
        }
    }

    return Array.from(permissionsMap.entries()).map(([name, permClass]) => ({ name, class: permClass }));
}

async function seedMissingPermissions() {
    try {
        const permissionsWithClasses = await extractPermissionsFromFiles();
        const existingPermissions = await Permission.findAll({ attributes: ['name'] }).then(perms => perms.map(p => p.name));
        const missingPermissions = permissionsWithClasses.filter(perm => !existingPermissions.includes(perm.name));

        if (missingPermissions.length > 0) {
            const permissionObjects = missingPermissions.map(perm => ({
                permissionID: `perm_${nanoid()}`,
                name: perm.name,
                type: perm.name.startsWith('access_') ? 'page' : 'feature',
                class: perm.class,
                description: `Auto-generated permission for ${perm.name} (Class: ${perm.class})`,
            }));
            let newPermissions = 0;
            for (const perm of permissionObjects) {
                const [_, created] = await Permission.findOrCreate({
                    where: { name: perm.name },
                    defaults: perm,
                });
                if (created) newPermissions++;
            }
            console.log(`${new Date().toISOString()} - Seeded ${newPermissions} new permissions`);
        } else {
            console.log(`${new Date().toISOString()} - No new permissions to seed`);
        }
    } catch (error) {
        console.error('Error seeding permissions:', error);
        throw error;
    }
}

module.exports = { extractPermissionsFromFiles, seedMissingPermissions };

if (require.main === module) {
    const { sequelize } = require('../config/db');
    seedMissingPermissions().then(() => sequelize.close());
}