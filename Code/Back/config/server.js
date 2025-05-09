const fs = require('fs');
const https = require('https');
const http = require('http');
const mdns = require('mdns-js');
require('dotenv').config();
const logger = require('../utils/logger');

// Sets up the HTTP/HTTPS server, attaches Socket.IO (if enabled), and advertises via mDNS
async function initializeServer(app, io) {
    const PORT = process.env.PORT || 5000;
    let server;

    if (process.env.NODE_ENV === 'production' && fs.existsSync(process.env.SSL_KEY_PATH)) {
        const options = {
            key: fs.readFileSync(process.env.SSL_KEY_PATH),
            cert: fs.readFileSync(process.env.SSL_CERT_PATH),
        };
        server = https.createServer(options, app);
    } else {
        server = http.createServer(app);
    }

    if (io && process.env.INIT_SOCKET === 'true') {
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            process.env.FRONTEND_URL1,
        ];
        io.attach(server, {
            cors: {
                origin: allowedOrigins,
                methods: ['GET', 'POST'],
                credentials: true,
            },
            pingTimeout: 20000,
            pingInterval: 25000,
        });

        io.on('connection', (socket) => {
            socket.on('join', (room) => {
                socket.join(room);
            });

            socket.on('leave', (room) => {
                socket.leave(room);
            });
        });

        io.on('connect_error', (error) => {
            logger.error('WebSocket server connection error', {
                message: error.message,
                stack: error.stack,
                route: 'websocket',
                service: 'socket.io',
            });
        });
    }

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