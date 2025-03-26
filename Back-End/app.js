const cors = require('cors');
const express = require('express');
const {
    initializeDatabase,
    initializeSMTP,
    initializeSMS,
    initializeServer,
} = require('./config');
const { sequelize } = require('./config/db');
const { authenticateJWT } = require('./config/security');

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
app.use((req, res, next) => {
    if (req.user) {
        sequelize.query(`SET jwt.claims.userID = '${req.user.userID}'`).catch(err => console.error(`${new Date().toISOString()} - Failed to set RLS userID:`, err));
    }
    next();
});

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

app.get('/test', authenticateJWT, (req, res) => {
    res.json({ message: 'Secure endpoint accessed', user: req.user });
});

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

    const logStep = (step, success, message, error = null) => {
        const timestamp = new Date().toISOString();
        console.log(`${timestamp} - ${step}: ${message}${error ? ` - Error: ${error.message}` : ''}`);
        summary.steps.push({ step, success, message, error });
        summary[success ? 'successes' : 'failures']++;
    };

    try {
        console.log(`${new Date().toISOString()} - Starting application initialization...`);

        await initializeDatabase();
        logStep('Database Initialization', true, 'Completed successfully');

        await initializeSMTP();
        logStep('SMTP Initialization', true, 'Completed successfully');

        await initializeSMS();
        logStep('SMS Initialization', true, 'Completed successfully');

        setupAssociations();
        logStep('Model Associations', true, 'Relationships established');

        await sequelize.sync({ alter: true });
        logStep('Database Sync', true, 'Tables synchronized');

        await seedMissingPermissions();
        logStep('Permission Seeding', true, 'Completed successfully');

        await initializeServer(app);
        logStep('Server Initialization', true, 'Server started');

        await seedSuperAdmin();
        logStep('Super Admin Seeding', true, 'Completed successfully');

        const endTime = new Date();
        const duration = (endTime - startTime) / 1000;
        console.log(`${new Date().toISOString()} - Initialization Summary:`);
        console.log(`  Total Steps: ${summary.steps.length}`);
        console.log(`  Successes: ${summary.successes}`);
        console.log(`  Failures: ${summary.failures}`);
        console.log(`  Duration: ${duration.toFixed(2)} seconds`);
    } catch (error) {
        console.error(`${new Date().toISOString()} - Application initialization failed:`, error);
        process.exit(1);
    }
}

startApp();