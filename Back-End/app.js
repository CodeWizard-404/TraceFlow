const express = require('express');
const cors = require('cors');
const mdns = require('mdns-js');
const { sequelize, initializeDatabase } = require('./config/db');
const { setupAssociations } = require('./models');
const visitRoutes = require('./routes/visitRoutes');
const timesheetRoutes = require('./routes/timesheetRoutes');
const agentRoutes = require('./routes/agentRoutes');

// Create Express app (moved outside the async function)
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/visits', visitRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/agents', agentRoutes);

// Error handling middleware
app.use((err, req, res, next) => { // Added req and next parameters
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

async function initializeApp() {
    try {
        // 1. Create database if needed
        await initializeDatabase();
        
        // 2. Set up model relationships
        setupAssociations();
        
        // 3. Sync models with the database
        await sequelize.sync({ alter: true }); // Or remove sync entirely for production
        
        console.log('Database & tables synchronized!');
        
        // 4. Start Express server
        const PORT = process.env.PORT || 5000;
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT}`);
        });

        // 5. Advertise the service via mDNS
        const service = mdns.createAdvertisement(mdns.tcp('http'), PORT, {
            name: 'visit-management-backend', // Unique service name
            txt: { path: '/api' }
        });
        service.start();
        console.log('mDNS service advertised as visit-management-backend');
    } catch (error) {
        console.error('Application initialization failed:', error);
        process.exit(1);
    }
}

// Start the application
initializeApp();