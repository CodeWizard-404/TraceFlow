const express = require('express');
const cors = require('cors');
const { sequelize, initializeDatabase } = require('./config/db');
const { setupAssociations } = require('./models');
const visitRoutes = require('./routes/visitRoutes');
const timesheetRoutes = require('./routes/timesheetRoutes');

async function initializeApp() {
    try {
        // 1. Create database if needed
        await initializeDatabase();

        // 2. Set up model relationships
        setupAssociations();

        // 3. Create tables (force: true drops tables first - use only in development!)
        await sequelize.sync({ force: true });
        console.log('Database & tables created!');

        // 4. Start Express server
        const app = express();

        // Middleware
        app.use(cors());
        app.use(express.json());

        // Routes
        app.use('/api/visits', visitRoutes);
        app.use('/api/timesheets', timesheetRoutes);

        // Error handling
        app.use((err, req, res, next) => {
            console.error(err.stack);
            res.status(500).json({ error: 'Something went wrong!' });
        });

        // Start server
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error('Application initialization failed:', error);
        process.exit(1);
    }
}

// Start the application
initializeApp();