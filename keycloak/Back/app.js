const cors = require('cors');
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const cron = require('node-cron');
const otpService = require('./services/otpService');
const logger = require('./utils/logger');
const {
    initializeDatabase,
    initializeSMTP,
    initializeSMS,
    initializeServer,
} = require('./config');
const { sequelize } = require('./config/db');
const { authenticateCookie } = require('./config/security');

const { seedSuperAdmin } = require('./scripts/SeedSuperAdmin');
const { seedMissingPermissions } = require('./scripts/seedPermissions');

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

//const { migratePermissionsToKeycloak } = require('./scripts/migratePe');
//const { migrateToKeycloak } = require('./scripts/migrateURO');

require('dotenv').config();

const app = express();

const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://192.168.1.16:5000'
];

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204, // For legacy browsers
};


app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

// Serve static files
app.use('/api/uploads', express.static(path.join(__dirname, 'Uploads')));

app.use('/api/auth', authRoutes);

// Apply authentication to all /api routes

app.use('/api/users', authenticateCookie, userRoutes);
app.use('/api/roles', authenticateCookie, roleRoutes);
app.use('/api/permissions', authenticateCookie, permissionRoutes);
app.use('/api/visits', authenticateCookie, visitRoutes);
app.use('/api/checklists', authenticateCookie, checklistRoutes);
app.use('/api/reasons', authenticateCookie, reasonRoutes);
app.use('/api/timesheets', authenticateCookie, timesheetRoutes);
app.use('/api/agents', authenticateCookie, agentRoutes);
app.use('/api/receipt-books', authenticateCookie, receiptBookRoutes);
app.use('/api/receipt-stubs', authenticateCookie, receiptStubRoutes);

// Test endpoint
app.get('/api/test', authenticateCookie, (req, res) => {
    res.json({ message: 'Secure endpoint accessed', user: req.user });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error(`Server error: ${err.stack}`, { ip: req.ip });
    res.status(500).json({ error: 'Something went wrong!' });
});

cron.schedule('0 * * * *', async () => {
    try {
        logger.info('Cleaning up expired OTPs');
        await otpService.cleanupExpiredOTPs();
    } catch (error) {
        logger.error('Error cleaning up OTPs:', error.message);
    }
});

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
        //await migratePermissionsToKeycloak();
        //await migrateToKeycloak();

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

        await initializeServer(app);
        addStep('Server Initialization', true, 'Completed');

        await seedSuperAdmin();
        addStep('Super Admin Seeding', true, 'Completed');

        const endTime = new Date();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log(`\n${colors.cyan}========== TraceFlow Initialization Summary ========${colors.reset}`);
        console.log(`Date: ${new Date().toISOString()}`);
        console.log('Steps Completed:');
        summary.steps.forEach(({ step, success, message }) => {
            const status = success ? `${colors.green}Success${colors.reset}` : `${colors.red}Failed${colors.reset}`;
            console.log(`  - ${step}: ${status} - ${message}`);
        });
        console.log(`Total Steps: ${summary.steps.length}`);
        console.log(`${colors.yellow}Successes: ${summary.successes}${colors.reset}`);
        console.log(`${colors.yellow}Failures: ${summary.failures}${colors.reset}`);
        console.log(`Duration: ${duration} seconds`);
        console.log(`${colors.cyan}====================================================${colors.reset}\n`);
    } catch (error) {
        addStep('Initialization', false, `Failed: ${error.message}`);
        const endTime = new Date();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log(`\n${colors.cyan}=== TraceFlow Initialization Summary ===${colors.reset}`);
        console.log(`Date: ${new Date().toISOString()}`);
        console.log('Steps Completed:');
        summary.steps.forEach(({ step, success, message }) => {
            const status = success ? `${colors.green}Success${colors.reset}` : `${colors.red}Failed${colors.reset}`;
            console.log(`  - ${step}: ${status} - ${message}`);
        });
        console.log(`Total Steps: ${summary.steps.length}`);
        console.log(`${colors.yellow}Successes: ${summary.successes}${colors.reset}`);
        console.log(`${colors.yellow}Failures: ${summary.failures}${colors.reset}`);
        console.log(`Duration: ${duration} seconds`);
        console.log(`${colors.cyan}=======================================${colors.reset}\n`);
        process.exit(1);
    }
}

startApp();