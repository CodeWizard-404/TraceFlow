const fs = require('fs');
const https = require('https');
const http = require('http');
const mdns = require('mdns-js');
const logger = require('../utils/logger');
require('dotenv').config();

// Sets up the HTTP/HTTPS server, attaches Socket.IO, and advertises via mDNS
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

    if (io) {
        const allowedOrigins = [
            'http://localhost:5173',
            'http://192.168.1.14:5173',
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
            logger.info('Client connected', { socketId: socket.id, timestamp: new Date().toISOString() });

            socket.on('join', (room) => {
                socket.join(room);
                logger.info(`Client joined room: ${room}`, { socketId: socket.id, timestamp: new Date().toISOString() });
            });

            socket.on('leave', (room) => {
                socket.leave(room);
                logger.info(`Client left room: ${room}`, { socketId: socket.id, timestamp: new Date().toISOString() });
            });

            socket.on('disconnect', () => {
                logger.info('Client disconnected', { socketId: socket.id, timestamp: new Date().toISOString() });
            });
        });

        io.on('connect_error', (error) => {
            logger.error(`WebSocket server connection error: ${error.message}`, {
                stack: error.stack,
                timestamp: new Date().toISOString(),
            });
        });
    }

    server.listen(PORT, '0.0.0.0', () => {
        logger.info(`${new Date().toISOString()} - ${process.env.NODE_ENV === 'production' ? 'HTTPS' : 'HTTP'} Server running on port ${PORT}`);
    });

    // mDNS advertisement (disabled in development to avoid conflicts)
    if (process.env.NODE_ENV !== 'development') {
        const service = mdns.createAdvertisement(mdns.tcp('http'), PORT, {
            name: 'TraceFlow-backend',
            txt: { path: '/api' },
        });
        service.start();
        logger.info(`${new Date().toISOString()} - mDNS service advertised as TraceFlow-backend`);
    } else {
        logger.info(`${new Date().toISOString()} - mDNS advertisement skipped in development mode`);
    }

    return server;
}

module.exports = { initializeServer };