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
const inquirer = require('inquirer');
const cliProgress = require('cli-progress');
const colors = require('ansi-colors');
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
    logger.error(`Server error: ${err.message}`, { ip: req.ip, stack: err.stack });
    res.status(500).json({ error: 'Something went wrong!' });
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

    // Create progress bar
    const progressBar = new cliProgress.SingleBar({
        format: `${colors.cyan('Overall Progress')} |${colors.green('{bar}')}| {percentage}% | {value}/{total} Steps`,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
    }, cliProgress.Presets.shades_classic);

    // Calculate total weight for overall progress
    const totalWeight = initSteps.reduce((sum, step) => sum + step.weight, 0);
    let currentWeight = 0;

    progressBar.start(initSteps.length, 0);

    // Ask for initialization mode on first launch
    const { mode } = process.env.FIRST_LAUNCH !== 'false' ? await inquirer.prompt([
        {
            type: 'list',
            name: 'mode',
            message: 'Select server initialization mode:',
            choices: [
                { name: 'Run all steps (default)', value: 'default' },
                { name: 'Control each step', value: 'controlled' },
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
            let executeStep = mode === 'default' ? step.default : false;

            if (mode === 'controlled') {
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

                // Execute step function
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

            // Update overall progress
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

            // Prompt to continue or exit on failure
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

    // Log summary
    const endTime = new Date();
    summary.duration = ((endTime - startTime) / 1000).toFixed(2);

    logger.info(`${colors.cyan('========== TraceFlow Initialization Summary ========')}`, {
        timestamp: new Date().toISOString(),
    });
    logger.info(`Date: ${new Date().toISOString()}`);
    logger.info('Steps Completed:');
    summary.steps.forEach(({ step, status, message, duration }) => {
        const color = status === 'success' ? colors.green : status === 'skipped' ? colors.yellow : colors.red;
        logger.info(`  - ${step}: ${color(status.toUpperCase())} - ${message} (${duration}s)`, {
            step,
            status,
            message,
            duration,
        });
    });
    logger.info(`Total Steps: ${summary.steps.length}`);
    logger.info(`${colors.green(`Successes: ${summary.successes}`)}`);
    logger.info(`${colors.yellow(`Skipped: ${summary.skipped}`)}`);
    logger.info(`${colors.red(`Failures: ${summary.failures}`)}`);
    logger.info(`Total Duration: ${summary.duration} seconds`);
    logger.info(`${colors.cyan('===================================================')}`);

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