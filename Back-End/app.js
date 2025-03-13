const express = require('express');
const cors = require('cors');
const mdns = require('mdns-js');
const https = require('https');
const fs = require('fs');
const { sequelize, initializeDatabase } = require('./config/db');
const { transporter, initializeSMTP } = require('./config/smtp');
const { sendSMS, initializeSMS } = require('./config/sms');
const { authenticateJWT, restrictTo } = require('./config/security');
const { setupAssociations } = require('./models');
const visitRoutes = require('./routes/visitRoutes');
const timesheetRoutes = require('./routes/timesheetRoutes');
const agentRoutes = require('./routes/agentRoutes');
const checklistRoutes = require('./routes/checklistRoutes');
const reasonRoutes = require('./routes/reasonRoutes');
const authRoutes = require('./routes/authRoutes');
const receiptBookRoutes = require('./routes/receiptBookRoutes');
const receiptStubRoutes = require('./routes/receiptStubRoutes');

require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    if (req.user) {
        sequelize.query(`SET jwt.claims.userID = '${req.user.userID}'`)
            .catch(err => console.error('Failed to set RLS userID:', err));
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
app.use('/api/receipt-books', receiptBookRoutes);
app.use('/api/receipt-stubs', receiptStubRoutes);

// Test secure endpoint
app.get('/test', authenticateJWT, restrictTo('Super Admin', 'Manager'), (req, res) => {
    res.json({ message: 'Secure endpoint accessed', user: req.user });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize application
async function initializeApp() {
    try {
        await initializeDatabase();
        await initializeSMTP();
        
        try {
            await initializeSMS();
        } catch (smsError) {
            console.warn('SMS initialization failed, proceeding without SMS:', smsError.message);
        }

        setupAssociations();
        await sequelize.sync({ alter: true }); // Replace with migrations in production
        console.log('Database & tables synchronized!');

        const PORT = process.env.PORT;
        let server;

        if (process.env.NODE_ENV === 'production' && fs.existsSync('path/to/key.pem')) {
            const options = {
                key: fs.readFileSync('path/to/key.pem'),
                cert: fs.readFileSync('path/to/cert.pem'),
            };
            server = https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
                console.log(`HTTPS Server running on port ${PORT}`);
            });
        } else {
            server = app.listen(PORT, '0.0.0.0', () => {
                console.log(`HTTP Server running on port ${PORT}`);
            });
        }

        // mDNS advertisement
        const service = mdns.createAdvertisement(mdns.tcp('http'), PORT, {
            name: 'visit-management-backend',
            txt: { path: '/api' },
        });
        service.start(); // Start broadcasting immediately
        console.log('mDNS service advertised as visit-management-backend');

    } catch (error) {
        console.error('Application initialization failed:', error);
        process.exit(1);
    }
}

initializeApp();