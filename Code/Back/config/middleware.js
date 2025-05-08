const cors = require('cors');
const cookieParser = require('cookie-parser');
const express = require('express');
const path = require('path');
const { corsOptions } = require('./cors');

function setupMiddleware(app) {
    app.use(cors({
        ...corsOptions,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Google-API-Key'],
    }));
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/uploads', express.static(path.join(__dirname, '../Uploads')));
}

module.exports = { setupMiddleware };