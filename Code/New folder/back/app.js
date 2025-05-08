const express = require('express');
const path = require('path');
const logger = require('./utils/logger');
const { sequelize } = require('./config/db');
const { authenticateCookie } = require('./config/security');
const {
    initializeDatabase,
    initializeSMTP,
    initializeSMS,
    initializeServer,
    initializeRedis,
    initializeGoogleServices,
} = require('./config');
const { setupAssociations } = require('./models');
const populateGeographicData = require('./scripts/seedLocations');
const seedAgents = require('./scripts/seedAgents');
const { seedSuperAdmin } = require('./scripts/SeedSuperAdmin');
const { seedMissingPermissions } = require('./scripts/seedPermissions');
const { setupCron } = require('./config/scheduler');
const { setupMiddleware } = require('./config/middleware');
const { setupRoutes } = require('./config/routes');
const io = require('./utils/socket');
const inquirer = require('inquirer');
const cliProgress = require('cli-progress');
const colors = require('ansi-colors');
const expressJSDocSwagger = require('express-jsdoc-swagger');
const redoc = require('redoc-express');
require('dotenv').config();

// Create Express app
const app = express();

// Middleware setup
setupMiddleware(app);

// Initialize express-jsdoc-swagger
expressJSDocSwagger(app)({
    info: {
        title: 'TraceFlow API',
        version: '1.0.0',
        description: 'API documentation for the TraceFlow backend, including Google Services integration.',
    },
    servers: [
        {
            url: process.env.NODE_ENV === 'production' ? process.env.PROD_URL : `${process.env.DEV_URL}:${process.env.PORT}`,
        },
    ],
    baseDir: __dirname,
    filesPattern: ['./routes/*.js', './models/**/*.js'],
    security: {
        BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
        },
        CookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'accessToken',
        },
    },
});

// Route setup
setupRoutes(app);

// Serve OpenAPI spec
app.get('/openapi.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'openapi.json'));
});

// ReDoc setup
app.use('/api/docs', redoc({
    title: 'TraceFlow API Documentation',
    specUrl: '/openapi.json',
}));

// Test endpoint
app.get('/api/test', authenticateCookie, (req, res) => {
    res.json({ message: 'Secure endpoint accessed', user: req.user });
});

// Error handling
app.use((err, req, res, next) => {
    logger.error(`Server error: ${err.message}`, { ip: req.ip, stack: err.stack });
    res.status(err.status || 500).json({
        error: err.message || 'Something went wrong!',
    });
});

// Schedule tasks
setupCron();

// Initialization steps configuration
const initSteps = [
    {
        name: 'Database Initialization',
        key: 'database',
        default: process.env.INIT_DATABASE !== 'false',
        fn: initializeDatabase,
        weight: 20,
    },
    {
        name: 'SMTP Initialization',
        key: 'smtp',
        default: process.env.INIT_SMTP !== 'false',
        fn: initializeSMTP,
        weight: 10,
    },
    {
        name: 'SMS Initialization',
        key: 'sms',
        default: process.env.INIT_SMS !== 'false',
        fn: initializeSMS,
        weight: 10,
    },
    {
        name: 'Redis Initialization',
        key: 'redis',
        default: process.env.INIT_REDIS !== 'false',
        fn: initializeRedis,
        weight: 10,
    },
    {
        name: 'Google Services Configuration',
        key: 'googleServices',
        default: process.env.INIT_GOOGLE_SERVICES !== 'false',
        fn: initializeGoogleServices,
        weight: 10,
    },
    {
        name: 'Model Associations',
        key: 'associations',
        default: process.env.INIT_ASSOCIATIONS !== 'false',
        fn: setupAssociations,
        weight: 10,
    },
    {
        name: 'Database Synchronization',
        key: 'sync',
        default: process.env.INIT_DB_SYNC === 'true',
        fn: () => sequelize.sync({ alter: true }),
        weight: 20,
    },
    {
        name: 'Geographic Data Initialization',
        key: 'geoData',
        default: process.env.INIT_GEO_DATA !== 'false',
        fn: async () => {
            try {
                await populateGeographicData();
            } catch (error) {
                throw error;
            }
        },
        weight: 10,
    },
    {
        name: 'Agent Data Seeding',
        key: 'agents',
        default: process.env.INIT_AGENTS === 'true',
        fn: seedAgents,
        weight: 15,
    },
    {
        name: 'Permission Seeding',
        key: 'permissions',
        default: process.env.INIT_PERMISSIONS === 'true',
        fn: seedMissingPermissions,
        weight: 15,
    },
    {
        name: 'Super Admin Seeding',
        key: 'superadmin',
        default: process.env.INIT_SUPERADMIN === 'true',
        fn: seedSuperAdmin,
        weight: 15,
    },
    {
        name: 'Socket Initialization',
        key: 'socket',
        default: process.env.INIT_SOCKET !== 'false',
        fn: () => {
            process.env.INIT_SOCKET = 'true';
        },
        weight: 15,
    },
    {
        name: 'Server Initialization',
        key: 'server',
        default: process.env.INIT_SERVER !== 'false',
        fn: () => initializeServer(app, io),
        weight: 20,
    },
];

// Start the application
async function startApp() {
    const startTime = new Date();
    const summary = {
        steps: [],
        successes: 0,
        failures: 0,
        skipped: 0,
        duration: 0,
    };

    const progressBar = new cliProgress.SingleBar({
        format: `${colors.cyan('Overall Progress')} |${colors.green('{bar}')}| {percentage}% | {value}/{total} Steps`,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
    }, cliProgress.Presets.shades_classic);

    const totalWeight = initSteps.reduce((sum, step) => sum + step.weight, 0);
    let currentWeight = 0;

    progressBar.start(initSteps.length, 0);

    const { mode } = process.env.FIRST_LAUNCH !== 'false' ? await inquirer.prompt([
        {
            type: 'list',
            name: 'mode',
            message: 'Select server initialization mode:',
            choices: [
                { name: 'Default: Run steps based on their configured defaults (env variables)', value: 'default' },
                { name: 'Controlled: Manually choose which steps to execute', value: 'controlled' },
                { name: 'Launch all: Execute all steps regardless of defaults', value: 'all' },
            ],
            default: 'default',
        },
    ]) : { mode: 'controlled' };

    process.env.FIRST_LAUNCH = 'false';

    for (const [index, step] of initSteps.entries()) {
        const stepStartTime = new Date();
        let status = 'pending';
        let message = '';
        let stepProgress = 0;

        try {
            let executeStep = false;
            if (mode === 'default') {
                executeStep = step.default;
            } else if (mode === 'all') {
                executeStep = true;
            } else if (mode === 'controlled') {
                const { confirm } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: `Execute ${step.name}? (Default: ${step.default ? 'Yes' : 'No'})`,
                        default: step.default,
                    },
                ]);
                executeStep = confirm;
            }

            if (!executeStep) {
                status = 'skipped';
                message = 'Skipped by user';
                summary.skipped++;
                logger.info(`${step.name}: Skipped`, {
                    step: step.key,
                    status,
                    timestamp: new Date().toISOString(),
                });
            } else {
                logger.info(`${step.name}: Starting`, {
                    step: step.key,
                    timestamp: new Date().toISOString(),
                });

                await step.fn();

                stepProgress = 100;
                status = 'success';
                message = 'Completed successfully';
                summary.successes++;

                logger.info(`${step.name}: Completed`, {
                    step: step.key,
                    status,
                    duration: ((new Date() - stepStartTime) / 1000).toFixed(2),
                    timestamp: new Date().toISOString(),
                });
            }

            currentWeight += step.weight;
            const overallProgress = Math.round((currentWeight / totalWeight) * initSteps.length);
            progressBar.update(overallProgress);
        } catch (error) {
            status = 'failed';
            message = `Failed: ${error.message}`;
            summary.failures++;

            logger.error(`${step.name}: Failed`, {
                step: step.key,
                status,
                error: error.message,
                stack: error.stack,
                duration: ((new Date() - stepStartTime) / 1000).toFixed(2),
                timestamp: new Date().toISOString(),
            });

            const { continueOnError } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'continueOnError',
                    message: `${step.name} failed: ${error.message}. Continue with next steps?`,
                    default: false,
                },
            ]);

            if (!continueOnError) {
                progressBar.stop();
                throw new Error(`Initialization aborted after ${step.name} failure`);
            }
        }

        summary.steps.push({
            step: step.name,
            key: step.key,
            status,
            message,
            duration: ((new Date() - stepStartTime) / 1000).toFixed(2),
        });
    }

    progressBar.stop();
    console.clear();

    const endTime = new Date();
    summary.duration = ((endTime - startTime) / 1000).toFixed(2);

    logger.info(`${colors.cyan('========== TraceFlow Initialization Summary ========')}`, {
        timestamp: new Date().toISOString(),
    });
    logger.info(`Date: ${new Date().toISOString()}`);
    logger.info('Steps Completed:');
    summary.steps.forEach(({ step, status, message, duration }) => {
        const color = status === 'success' ? colors.green : status === 'skipped' ? colors.yellow : colors.red;
        logger.info(`  - ${step}: ${color(status.toUpperCase())} - (${duration}s)`, {
            step,
            status,
            duration,
        });
    });
    logger.info(`Total Steps: ${summary.steps.length}`);
    logger.info(`${colors.green(`Successes: ${summary.successes}`)}`);
    logger.info(`${colors.yellow(`Skipped: ${summary.skipped}`)}`);
    logger.info(`${colors.red(`Failures: ${summary.failures}`)}`);
    logger.info(`Total Duration: ${summary.duration} seconds`);
    logger.info(`${colors.cyan('===================================================')}`);

    if (process.env.NODE_ENV === 'development') {
        logger.info(`${colors.cyan('===================================================')}`);
        logger.info(`\tSuper Admin Credentials:`);
        logger.info(`\tEmail:\t\t${process.env.SUPER_ADMIN_EMAIL}`);
        logger.info(`\tPassword:\t${process.env.SUPER_ADMIN_PASSWORD}`);
        logger.info(`${colors.cyan('===================================================')}`);
    }

    if (summary.failures > 0) {
        process.exit(1);
    }
}

startApp().catch(error => {
    logger.error(`Initialization failed: ${error.message}`, {
        stack: error.stack,
        timestamp: new Date().toISOString(),
    });
    process.exit(1);
});