const fs = require('fs');
const https = require('https');
const http = require('http');
const mdns = require('mdns-js');
require('dotenv').config();
const logger = require('../utils/logger');

async function initializeServer(app, io) {
    const PORT = process.env.PORT || 5000;
    let server;

    // Initialize server with SSL for production or HTTP for development
    if (process.env.NODE_ENV === 'production') {
        const options = {
            key: fs.readFileSync(process.env.SSL_KEY_PATH),
            cert: fs.readFileSync(process.env.SSL_CERT_PATH),
        };
        server = https.createServer(options, app);
    } else {
        server = http.createServer(app);
    }

    if (io && process.env.INIT_SOCKET === 'true') {
        // Define allowed CORS origins, with fallback for undefined env vars
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            process.env.FRONTEND_URL1,
        ].filter(origin => origin); // Remove falsy values

        // Attach Socket.IO to server
        io.attach(server, {
            cors: {
                origin: allowedOrigins,
                methods: ['GET', 'POST'],
                credentials: true,
            },
            pingTimeout: 20000,
            pingInterval: 25000,
        });

        // Set up Redis adapter with separate clients
        try {
            const { initializeRedis } = require('./redis');
            const { createAdapter } = require('@socket.io/redis-adapter');
            const { redisClient, redisSubClient } = await initializeRedis(); // Ensure Redis is initialized
            io.adapter(createAdapter(redisClient, redisSubClient));

            logger.info('Socket.IO Redis adapter initialized successfully', {
                route: 'websocket',
                service: 'socket.io',
                metadata: { adapter: 'redis' },
            });
        } catch (error) {
            logger.error('Failed to initialize Socket.IO Redis adapter', {
                route: 'websocket',
                service: 'socket.io',
                error: error.message,
            });
            throw error; // Stop server if Redis adapter fails
        }

        // Socket.IO event handlers are defined in utils/socket.js
        io.on('connect_error', (error) => {
            logger.error('WebSocket server connection error', {
                message: error.message,
                stack: error.stack,
                route: 'websocket',
                service: 'socket.io',
            });
        });
    }

    // Start server
    server.listen(PORT, '0.0.0.0', () => {
        logger.info(`Server started: ${process.env.NODE_ENV === 'production' ? 'HTTPS' : 'HTTP'} on port ${PORT}`, {
            route: 'server',
            service: 'express',
        });
    });

    // mDNS advertisement (disabled in development to avoid conflicts)
    if (process.env.NODE_ENV !== 'development') {
        const service = mdns.createAdvertisement(mdns.tcp('http'), PORT, {
            name: 'TraceFlow-backend',
            txt: { path: '/api' },
        });
        service.start();
        logger.info('mDNS advertisement started', { route: 'mdns', service: 'discovery' });
    } else {
        logger.info('mDNS advertisement skipped in development mode', { route: 'mdns', service: 'discovery' });
    }

    return server;
}

module.exports = { initializeServer };