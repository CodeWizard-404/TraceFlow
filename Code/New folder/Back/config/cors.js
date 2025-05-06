const cors = require('cors');
require('dotenv').config();

// Define allowed origins for CORS
const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL1,
];

// Configure CORS
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204,
};

module.exports = { corsOptions };