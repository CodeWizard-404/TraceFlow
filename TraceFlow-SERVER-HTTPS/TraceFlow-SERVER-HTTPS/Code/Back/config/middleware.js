const cors = require('cors');
const cookieParser = require('cookie-parser');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const { corsOptions } = require('./cors');
const logger = require('../utils/logger');

function setupMiddleware(app) {
    app.use(logger.addRequestTracing);
    app.use(cors({ ...corsOptions, allowedHeaders: ['Content-Type', 'Authorization', 'X-Google-API-Key'] }));
    app.use(cookieParser());
    app.use(express.json());
    app.use(helmet());
    app.use(compression());
    app.use('/api/uploads', express.static('../uploads'));
}

module.exports = { setupMiddleware };