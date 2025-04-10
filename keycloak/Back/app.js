const cors = require('cors');
const express = require('express');
const path = require('path');
const {
    initializeDatabase,
    initializeSMTP,
    initializeSMS,
    initializeServer,
} = require('./config');
const { sequelize } = require('./config/db');
const { authenticateKeycloak } = require('./config/security');

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

require('dotenv').config();

const app = express();

const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:3000',
    'http://192.168.1.11:5173',
];

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

// Set RLS userID based on Keycloak token
app.use((req, res, next) => {
    if (req.user) {
        sequelize.query(`SET jwt.claims.userID = '${req.user.userID}'`)
            .catch(err => console.error(`${new Date().toISOString()} - Failed to set RLS userID:`, err));
    }
    next();
});

// Serve static files
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);

// Apply Keycloak authentication to all /api routes
app.use('/api', authenticateKeycloak);

app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/reasons', reasonRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/receipt-books', receiptBookRoutes);
app.use('/api/receipt-stubs', receiptStubRoutes);

// Test endpoint
app.get('/test', authenticateKeycloak, (req, res) => {
    res.json({ message: 'Secure endpoint accessed', user: req.user });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(`${new Date().toISOString()} - Server error:`, err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
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

    // ANSI color codes
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

        await initializeServer(app);
        addStep('Server Initialization', true, 'Completed');

        await seedSuperAdmin();
        addStep('Super Admin Seeding', true, 'Completed');

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