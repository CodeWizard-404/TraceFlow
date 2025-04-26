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
            process.env.FRONTEND_URL,
            process.env.FRONTEND_URL1,
        ].filter(Boolean);
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
            logger.info(`WebSocket handshake successful for client: ${socket.id}`);

            socket.on('error', (error) => {
                logger.error(`WebSocket error for client ${socket.id}: ${error.message}`, {
                    stack: error.stack,
                    ip: socket.handshake.address,
                    timestamp: new Date().toISOString(),
                });
            });

            socket.on('disconnect', (reason) => {
                logger.info(`WebSocket disconnected for client ${socket.id}: ${reason}`, {
                    ip: socket.handshake.address,
                    user: socket.user?.email || 'unknown',
                    timestamp: new Date().toISOString(),
                });
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