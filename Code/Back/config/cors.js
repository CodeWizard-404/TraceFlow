const cors = require('cors');
require('dotenv').config();
const logger = require('../utils/logger');

// Define allowed origins for CORS
const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL1,
    'http://localhost:5173', // Explicitly allow frontend origin
].filter(Boolean);

// Configure CORS
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn(`CORS blocked for origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id'],
    credentials: true,
    optionsSuccessStatus: 200,
};

module.exports = { corsOptions };