const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const db = require('./models'); 

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(bodyParser.json()); // Parse JSON request bodies
app.use(express.json()); // Parse JSON request bodies (alternative to bodyParser)

// Database connection
db.sequelize
    .authenticate()
    .then(() => {
        console.log('Database connection has been established successfully.');
    })
    .catch((err) => {
        console.error('Unable to connect to the database:', err.message);
    });

// Routes
const visitRoutes = require('./routes/visitRoutes');
const timesheetRoutes = require('./routes/timesheetRoutes');

app.use('/api/visits', visitRoutes); 
app.use('/api/timesheets', timesheetRoutes);

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Export the app for use in server.js
module.exports = app;