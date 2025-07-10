const express = require('express');
const path = require('path');
const colors = require('ansi-colors');
require('dotenv').config();

const app = express();

process.on('unhandledRejection', (reason, promise) => {
    console.error(colors.red('Unhandled Rejection at:'), promise, 'reason:', reason);
    logger.error('Unhandled promise rejection', {
        reason: reason.message || reason,
        stack: reason.stack,
        service: 'application',
    });
});

process.on('uncaughtException', (error) => {
    console.error(colors.red('Uncaught Exception:'), error);
    logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
        service: 'application',
    });
});

const { initializeRedis } = require('./config/redis');
const logger = require('./utils/logger');
async function ensureRedisInitialized() {
    try {
        await initializeRedis();
    } catch (error) {
        console.error(colors.red(`Redis initialization failed: ${error.message}`));
        logger.error('Failed to initialize Redis', {
            error: error.message,
            stack: error.stack,
            service: 'redis',
        });
        process.exit(1);
    }
}

ensureRedisInitialized().then(() => {
    const { sequelize } = require('./config/db');
    const { authenticateCookie } = require('./config/security');
    const {
        initializeDatabase,
        initializeSMTP,
        initializeSMS,
        initializeServer,
        initializeGoogleServices,
        initializeAI,
    } = require('./config');
    const { setupAssociations } = require('./models');
    const populateGeographicData = require('./scripts/seedLocations');
    const seedAgents = require('./scripts/seedAgents');
    const { seedSuperAdmin } = require('./scripts/SeedSuperAdmin');
    const { seedMissingPermissions } = require('./scripts/seedPermissions');
    const seedAiConfig = require('./scripts/seedAiConfig');
    const { setupCron } = require('./config/scheduler');
    const { setupMiddleware } = require('./config/middleware');
    const { setupRoutes } = require('./config/routes');
    const io = require('./utils/socket');
    const { createAdapter } = require('@socket.io/redis-adapter');
    const { getRedisClient, getRedisSubClient } = require('./config/redis');
    const initializeCache = require('./utils/cache');
    const swaggerUi = require('swagger-ui-express');
    const swaggerSpec = require('./config/swagger');

    setupMiddleware(app);

    // Serve Swagger UI
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


    app.use('/logo', express.static(path.join(__dirname, 'Templates/logo')));

    setupRoutes(app);

    app.get('/api/test', authenticateCookie, (req, res) => {
        res.json({ message: 'Secure endpoint accessed', user: req.user });
    });

    app.use((err, req, res, next) => {
        logger.error(`Unhandled error: ${err.message}, stack: ${err.stack}, user: ${req.user?.userID || 'unknown'}, IP: ${req.ip}`);
        res.status(err.status || 500).json({
            error: err.message || 'Internal server error',
        });
    });

    setupCron();

    const initSteps = [
        {
            name: 'Database Initialization',
            key: 'database',
            condition: process.env.INIT_DATABASE !== 'false',
            fn: initializeDatabase,
        },
        {
            name: 'SMTP Initialization',
            key: 'smtp',
            condition: process.env.INIT_SMTP !== 'false',
            fn: initializeSMTP,
        },
        {
            name: 'SMS Initialization',
            key: 'sms',
            condition: process.env.INIT_SMS !== 'false',
            fn: initializeSMS,
        },
        {
            name: 'Cache Initialization',
            key: 'cache',
            condition: process.env.INIT_REDIS !== 'false',
            fn: async () => {
                global.cache = await initializeCache();
            },
        },
        {
            name: 'Google Services Configuration',
            key: 'googleServices',
            condition: process.env.INIT_GOOGLE_SERVICES !== 'false',
            fn: initializeGoogleServices,
        },
        {
            name: 'AI Module Initialization',
            key: 'ai',
            condition: process.env.INIT_AI !== 'false',
            fn: initializeAI,
        },
        {
            name: 'Model Associations',
            key: 'associations',
            condition: process.env.INIT_ASSOCIATIONS !== 'false',
            fn: setupAssociations,
        },
        {
            name: 'Database Synchronization',
            key: 'sync',
            condition: process.env.INIT_DB_SYNC === 'true',
            fn: () => sequelize.sync({ alter: true }),
        },
        {
            name: 'Geographic Data Initialization',
            key: 'geoData',
            condition: process.env.INIT_GEO_DATA !== 'false',
            fn: populateGeographicData,
        },
        {
            name: 'Agent Data Seeding',
            key: 'agents',
            condition: process.env.INIT_AGENTS === 'true',
            fn: seedAgents,
        },
        {
            name: 'Permission Seeding',
            key: 'permissions',
            condition: process.env.INIT_PERMISSIONS === 'true',
            fn: seedMissingPermissions,
        },
        {
            name: 'Super Admin Seeding',
            key: 'superadmin',
            condition: process.env.INIT_SUPERADMIN === 'true',
            fn: seedSuperAdmin,
        },
        {
            name: 'AI Configuration Seeding',
            key: 'aiConfig',
            condition: process.env.INIT_AI_CONFG === 'true',
            fn: seedAiConfig,
        },
        {
            name: 'Socket Initialization',
            key: 'socket',
            condition: process.env.INIT_SOCKET !== 'false',
            fn: async () => {
                const pubClient = getRedisClient();
                const subClient = getRedisSubClient();
                if (pubClient.status !== 'ready' || subClient.status !== 'ready') {
                    throw new Error('Redis clients not ready for Socket.IO adapter');
                }
                io.adapter(createAdapter(pubClient, subClient));
            },
        },
        {
            name: 'Server Initialization',
            key: 'server',
            condition: process.env.INIT_SERVER !== 'false',
            fn: () => initializeServer(app, io),
        },
    ];

    async function startApp() {
        const startTime = new Date();
        const summary = {
            steps: [],
            successes: 0,
            failures: 0,
            skipped: 0,
            duration: 0,
        };

        for (const step of initSteps) {
            const stepStartTime = new Date();
            let status = 'pending';
            let message = '';

            try {
                if (!step.condition) {
                    status = 'skipped';
                    message = 'Skipped due to .env configuration';
                    summary.skipped++;
                    console.log(colors.yellow(`\nStep skipped: ${step.name} - ${message}`));
                } else {
                    console.log(colors.cyan(`\nStep started: ${step.name}`));
                    await step.fn();
                    status = 'success';
                    message = 'Completed successfully';
                    summary.successes++;
                    console.log(colors.green(`Step completed: ${step.name} - ${message}`));
                }
            } catch (error) {
                status = 'failed';
                message = `Failed: ${error.message}`;
                summary.failures++;
                console.log(colors.red(`\nStep failed: ${step.name} - ${message}`));
                logger.error(`Initialization step failed: ${step.name}`, {
                    error: error.message,
                    stack: error.stack,
                    service: 'initialization',
                });
            }

            summary.steps.push({
                step: step.name,
                key: step.key,
                status,
                message,
                duration: ((new Date() - stepStartTime) / 1000).toFixed(2),
            });
        }

        const endTime = new Date();
        summary.duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log(colors.bold(`\n\n\n========== TraceFlow Initialization Summary ========`));
        console.log(`Date: ${new Date().toISOString()}`);
        console.log(`Steps Completed:`);
        summary.steps.forEach(({ step, status, duration }) => {
            const statusColor = status === 'success' ? colors.green : status === 'skipped' ? colors.yellow : colors.red;
            console.log(`  - ${step}: ${statusColor(status.toUpperCase())} - (${duration}s)`);
        });
        console.log(`Total Steps: ${summary.steps.length}`);
        console.log(`Successes: ${colors.green(summary.successes)}`);
        console.log(`Skipped: ${colors.yellow(summary.skipped)}`);
        console.log(`Failures: ${colors.red(summary.failures)}`);
        console.log(`Total Duration: ${summary.duration} seconds`);
        console.log(colors.bold(`===================================================`));

        if (process.env.NODE_ENV === 'development') {
            console.log(colors.bold(`===================================================`));
            console.log(colors.bold(`       Super Admin Credentials:`));
            console.log(`       Email:          ${process.env.SUPER_ADMIN_EMAIL}`);
            console.log(`       Password:       ${process.env.SUPER_ADMIN_PASSWORD}`);
            console.log(colors.bold(`===================================================`));
        }

        if (summary.failures > 0) {
            process.exit(1);
        }
    }

    startApp();

}).catch((error) => {
    console.error(colors.red(`Failed to initialize Redis: ${error.message}`));
    logger.error('Redis initialization failed', {
        error: error.message,
        stack: error.stack,
        service: 'redis',
    });
});