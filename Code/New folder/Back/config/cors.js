require('dotenv').config();

// Define allowed origins for CORS
const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL1,
    process.env.FRONTEND_URL2,
    process.env.GOOGLE_REDIRECT_URI,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI,
    '*'
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