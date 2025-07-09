// src/scripts/resetAll.js
const { migratePoliciesToKeycloak } = require('./migratePo');
const { migratePermissionsToKeycloak: migrateResources } = require('./migrateRe');
const { migratePermissionsToKeycloak } = require('./migratePe');
const RoleService = require('../services/roleService');

async function resetAll(actorID) {
    try {
        console.log('Starting reset process...');
        // Step 1: Migrate resources
        await migrateResources();
        console.log('Resources migration completed.');

        // Step 2: Migrate policies
        await migratePoliciesToKeycloak();
        console.log('Policies migration completed.');

        // Step 3: Migrate permissions
        await migratePermissionsToKeycloak();
        console.log('Permissions migration completed.');


        console.log('Reset process completed successfully.');
    } catch (error) {
        console.error('Reset process failed:', error.message);
        throw error;
    }
}

if (require.main === module) {
    const actorID = process.argv[2] || 'system'; // Pass actorID as argument or default to 'system'
    resetAll(actorID).catch(err => {
        console.error('Reset failed:', err.message);
        process.exit(1);
    });
}

module.exports = { resetAll };