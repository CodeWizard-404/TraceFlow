const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const logger = require('./utils/logger');
const { sequelize } = require('./config/db');
const { authenticateCookie } = require('./config/security');
const {
    initializeDatabase,
    initializeSMTP,
    initializeSMS,
    initializeServer,
} = require('./config');
const { setupAssociations } = require('./models');
const { seedSuperAdmin } = require('./scripts/SeedSuperAdmin');
const { seedMissingPermissions } = require('./scripts/seedPermissions');
const { corsOptions } = require('./config/cors');
const { setupCron } = require('./config/scheduler');
const { setupMiddleware } = require('./config/middleware');
const { setupRoutes } = require('./config/routes');
const io = require('./utils/socket');

require('dotenv').config();

// Create Express app
const app = express();

// Middleware setup
setupMiddleware(app);

// Route setup
setupRoutes(app);

// Test endpoint
app.get('/api/test', authenticateCookie, (req, res) => {
    res.json({ message: 'Secure endpoint accessed', user: req.user });
});

// Error handling
app.use((err, req, res, next) => {
    logger.error(`Server error: ${err.stack}`, { ip: req.ip });
    res.status(500).json({ error: 'Something went wrong!' });
});

// Schedule tasks
setupCron();

// Start the application
async function startApp() {
    const startTime = new Date();
    const summary = {
        steps: [],
        successes: 0,
        failures: 0,
    };

    const addStep = (step, success, message) => {
        summary.steps.push({ step, success, message });
        summary[success ? 'successes' : 'failures']++;
    };

    const colors = {
        reset: '\x1b[0m',
        cyan: '\x1b[36m',
        green: '\x1b[32m',
        red: '\x1b[31m',
        yellow: '\x1b[33m',
    };

    try {
        await initializeDatabase();
        addStep('Database Initialization', true, 'Completed');

        await initializeSMTP();
        addStep('SMTP Initialization', true, 'Completed');

        await initializeSMS();
        addStep('SMS Initialization', true, 'Completed');

        setupAssociations();
        addStep('Model Associations', true, 'Completed');

        await sequelize.sync({ alter: true });
        addStep('Database Synchronization', true, 'Completed');

        await seedMissingPermissions();
        addStep('Permission Seeding', true, 'Completed');

        await seedSuperAdmin();
        addStep('Super Admin Seeding', true, 'Completed');

        await initializeServer(app, io);
        addStep('Server Initialization', true, 'Completed with WebSocket');

        const endTime = new Date();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        logger.info(`${colors.cyan}========== TraceFlow Initialization Summary ========${colors.reset}`);
        logger.info(`Date: ${new Date().toISOString()}`);
        logger.info('Steps Completed:');
        summary.steps.forEach(({ step, success, message }) => {
            const status = success ? `${colors.green}Success${colors.reset}` : `${colors.red}Failed${colors.reset}`;
            logger.info(`  - ${step}: ${status} - ${message}`);
        });
        logger.info(`Total Steps: ${summary.steps.length}`);
        logger.info(`${colors.yellow}Successes: ${summary.successes}${colors.reset}`);
        logger.info(`${colors.yellow}Failures: ${summary.failures}${colors.reset}`);
        logger.info(`Duration: ${duration} seconds`);
        logger.info(`${colors.cyan}====================================================${colors.reset}\n`);
    } catch (error) {
        addStep('Initialization', false, `Failed: ${error.message}`);
        const endTime = new Date();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        logger.info(`\n${colors.cyan}=== TraceFlow Initialization Summary ===${colors.reset}`);
        logger.info(`Date: ${new Date().toISOString()}`);
        logger.info('Steps Completed:');
        summary.steps.forEach(({ step, success, message }) => {
            const status = success ? `${colors.green}Success${colors.reset}` : `${colors.red}Failed${colors.reset}`;
            logger.info(`  - ${step}: ${status} - ${message}`);
        });
        logger.info(`Total Steps: ${summary.steps.length}`);
        logger.info(`${colors.yellow}Successes: ${summary.successes}${colors.reset}`);
        logger.info(`${colors.yellow}Failures: ${summary.failures}${colors.reset}`);
        logger.info(`Duration: ${duration} seconds`);
        logger.info(`${colors.cyan}=======================================${colors.reset}\n`);
        process.exit(1);
    }
}

startApp();