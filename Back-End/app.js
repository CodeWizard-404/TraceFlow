const cors = require('cors');
const express = require('express');


const {
    initializeDatabase,
    initializeSMTP,
    initializeSMS,
    initializeServer,
} = require('./config');
const { seedSuperAdmin } = require('./config/SeedSuperAdmin');
const { sequelize } = require('./config/db');
const { authenticateJWT, restrictTo } = require('./config/security');
const { seedMissingPermissions } = require('./config/seedPermissions');
const { setupAssociations } = require('./models');


const agentRoutes = require('./routes/agentRoutes');
const authRoutes = require('./routes/authRoutes');
const checklistRoutes = require('./routes/checklistRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const reasonRoutes = require('./routes/reasonRoutes');
const receiptBookRoutes = require('./routes/receiptBookRoutes');
const receiptStubRoutes = require('./routes/receiptStubRoutes');
const roleRoutes = require('./routes/roleRoutes');
const timesheetRoutes = require('./routes/timesheetRoutes');
const userRoutes = require('./routes/userRoutes');
const visitRoutes = require('./routes/visitRoutes');

require('dotenv').config();

const app = express();

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse incoming JSON requests
app.use((req, res, next) => {
    if (req.user) {
        sequelize.query(`SET jwt.claims.userID = '${req.user.userID}'`)
            .catch(err => console.error(`${new Date().toISOString()} - Failed to set RLS userID:`, err));
    }
    next();
});

// Routes
app.use('/api/visits', visitRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/reasons', reasonRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/receipt-books', receiptBookRoutes);
app.use('/api/receipt-stubs', receiptStubRoutes);

// Test secure endpoint
app.get('/test', authenticateJWT, restrictTo('Super Admin', 'Manager'), (req, res) => {
    res.json({ message: 'Secure endpoint accessed', user: req.user });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(`${new Date().toISOString()} - Server error:`, err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Main application initialization function with detailed logging and summary
async function startApp() {
    const startTime = new Date();
    const summary = {
        steps: [],
        successes: 0,
        failures: 0,
    };

    // Helper function to log and track step results
    const logStep = (step, success, message, error = null) => {
        const timestamp = new Date().toISOString();
        console.log(`${timestamp} - ${step}: ${message}${error ? ` - Error: ${error.message}` : ''}`);
        summary.steps.push({ step, success, message, error });
        summary[success ? 'successes' : 'failures']++;
    };

    try {
        console.log(`${new Date().toISOString()} - Starting application initialization...`);

        // Step 1: Initialize database
        try {
            await initializeDatabase();
            logStep('Database Initialization', true, 'Completed successfully');
        } catch (dbError) {
            logStep('Database Initialization', false, 'Failed', dbError);
            throw dbError; // Stop execution on critical failure
        }

        // Step 2: Initialize SMTP
        try {
            await initializeSMTP();
            logStep('SMTP Initialization', true, 'Completed successfully');
        } catch (smtpError) {
            logStep('SMTP Initialization', false, 'Failed', smtpError);
            throw smtpError; // Stop execution on critical failure
        }

        // Step 3: Initialize SMS (non-critical)
        try {
            await initializeSMS();
            logStep('SMS Initialization', true, 'Completed successfully');
        } catch (smsError) {
            logStep('SMS Initialization', false, 'Proceeding without SMS', smsError);
            // Non-critical, continue execution
        }

        // Step 4: Set up model associations
        try {
            setupAssociations();
            logStep('Model Associations', true, 'Relationships established');
        } catch (assocError) {
            logStep('Model Associations', false, 'Failed', assocError);
            throw assocError; // Stop execution on critical failure
        }

        // Step 5: Sync database
        try {
            await sequelize.sync({ alter: true });
            logStep('Database Sync', true, 'Tables synchronized');
        } catch (syncError) {
            logStep('Database Sync', false, 'Failed', syncError);
            throw syncError; // Stop execution on critical failure
        }

        // Step 6: Seed missing permissions
        try {
            await seedMissingPermissions();
            logStep('Permission Seeding', true, 'Completed successfully');
        } catch (seedError) {
            logStep('Permission Seeding', false, 'Failed', seedError);
            throw seedError; // Stop execution on critical failure
        }

        // Step 7: Seed super admin
        try {
            await seedSuperAdmin();
            logStep('Super Admin Seeding', true, 'Completed successfully');
        } catch (superAdminError) {
            logStep('Super Admin Seeding', false, 'Failed', superAdminError);
            throw superAdminError;
        }

        // Step 8: Initialize server
        try {
            await initializeServer(app);
            logStep('Server Initialization', true, 'Server started');
        } catch (serverError) {
            logStep('Server Initialization', false, 'Failed', serverError);
            throw serverError; // Stop execution on critical failure
        }

        // Log summary
        const endTime = new Date();
        const duration = (endTime - startTime) / 1000; // Duration in seconds
        console.log(`${new Date().toISOString()} - Initialization Summary:`);
        console.log(`  Total Steps: ${summary.steps.length}`);
        console.log(`  Successes: ${summary.successes}`);
        console.log(`  Failures: ${summary.failures}`);
        console.log(`  Duration: ${duration.toFixed(2)} seconds`);
        console.log(`  Details:`);
        summary.steps.forEach((step, index) => {
            console.log(`    ${index + 1}. ${step.step}: ${step.success ? 'Success' : 'Failed'} - ${step.message}${step.error ? ` (Error: ${step.error.message})` : ''}`);
        });

    } catch (error) {
        console.error(`${new Date().toISOString()} - Application initialization failed:`, error);
        process.exit(1); // Exit with failure code
    }
}

startApp();