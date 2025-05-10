const cors = require('cors');
const cookieParser = require('cookie-parser');
const express = require('express');
const path = require('path');
const { corsOptions } = require('./cors');
const logger = require('../utils/logger');


function setupMiddleware(app) {
    app.use(logger.addRequestTracing);
    app.use(cors({
        ...corsOptions,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Google-API-Key'],
    }));
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/uploads', express.static(path.join(__dirname, '../Uploads')));
}

module.exports = { setupMiddleware };

