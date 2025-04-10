const path = require('path');

// Handle the IIFE-based migration with better error detection
function runUsersRolesOverridesMigration() {
    return new Promise((resolve, reject) => {
        console.log(`${new Date().toISOString()} - Running migrate_Users_Roles_Overrieds_ToKeycloak...`);
        try {
            const migration = require('./migrate_Users_Roles_Overrieds_ToKeycloak');
            // Wait for the IIFE to finish (assuming it logs completion)
            process.on('uncaughtException', (err) => {
                console.error(`${new Date().toISOString()} - Uncaught error in migrate_Users_Roles_Overrieds_ToKeycloak:`, err);
                reject(err);
            });
            setTimeout(() => {
                console.log(`${new Date().toISOString()} - Users, Roles, and Overrides migration completed (assumed).`);
                resolve();
            }, 2000); // Increased timeout to 2 seconds for safety
        } catch (error) {
            console.error(`${new Date().toISOString()} - Error loading migrate_Users_Roles_Overrieds_ToKeycloak:`, error);
            reject(error);
        }
    });
}

// Import the other migration scripts
const { migratePermissionsToKeycloak } = require('./migratePermissionsKeycloak');
const { migratePermissionsKeycloakAssignments } = require('./migratePermissionsKeycloakAssignments');
const { migratePoliciesToKeycloak } = require('./migratePoliciesKeycloak');

// Function to run migrations sequentially
async function runAllMigrations() {
    try {
        console.log(`${new Date().toISOString()} - Starting all migrations...`);

        // Step 1: Migrate Users, Roles, and Overrides
        await runUsersRolesOverridesMigration();

        // Step 2: Migrate Permissions to Keycloak (Resources)
        console.log(`${new Date().toISOString()} - Running migratePermissionsKeycloak...`);
        await migratePermissionsToKeycloak();
        console.log(`${new Date().toISOString()} - Permissions migration to Keycloak completed.`);

        // Step 3: Migrate Policies to Keycloak
        console.log(`${new Date().toISOString()} - Running migratePoliciesKeycloak...`);
        await migratePoliciesToKeycloak();
        console.log(`${new Date().toISOString()} - Policies migration to Keycloak completed.`);

        // Step 4: Migrate Permissions Assignments (Link Policies to Permissions)
        console.log(`${new Date().toISOString()} - Running migratePermissionsKeycloakAssignments...`);
        try {
            await migratePermissionsKeycloakAssignments();
            console.log(`${new Date().toISOString()} - Permissions assignments migration completed.`);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Permissions assignments migration failed but continuing:`, error.message);
            // Don’t throw here to allow the script to finish
        }

        console.log(`${new Date().toISOString()} - All migrations completed (with possible errors noted above).`);
    } catch (error) {
        console.error(`${new Date().toISOString()} - Critical migration failure:`, error);
        process.exit(1); // Exit only on critical errors (e.g., first three steps)
    }
}

// Execute the migrations
if (require.main === module) {
    runAllMigrations();
}

module.exports = { runAllMigrations };