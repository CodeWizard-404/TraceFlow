const { Server } = require('socket.io');
const { authenticateCookie } = require('../config/security');
const logger = require('./logger');

// Initialize Socket.IO server
const io = new Server({
    cors: {
        origin: [
            process.env.FRONTEND_URL,
            process.env.FRONTEND_URL1,
            'http://localhost:5173',
        ].filter(Boolean),
        methods: ['GET', 'POST'],
        credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
});

// Middleware to authenticate WebSocket connections
io.use(async (socket, next) => {
    try {
        const cookie = socket.handshake.headers.cookie;
        logger.info(`WebSocket handshake attempt: ${socket.id}`, {
            cookies: cookie ? cookie : 'None',
            ip: socket.handshake.address,
            origin: socket.handshake.headers.origin,
            referer: socket.handshake.headers.referer,
            headers: socket.handshake.headers,
            handshake: socket.handshake,
            timestamp: new Date().toISOString(),
        });

        if (!cookie) {
            throw new Error('No cookie provided in WebSocket handshake');
        }

        // Log the cookie contents
        const cookies = cookie.split(';').map(c => c.trim());
        logger.info(`Parsed cookies: ${cookies.join(', ')}`, {
            socketID: socket.id,
            timestamp: new Date().toISOString(),
        });

        // Check for accessToken cookie
        const tokenCookie = cookies.find(c => c.startsWith('accessToken='));
        if (!tokenCookie) {
            throw new Error('accessToken cookie not found in handshake');
        }
        logger.info(`Found accessToken cookie: ${tokenCookie.substring(0, 20)}...`, {
            socketID: socket.id,
            timestamp: new Date().toISOString(),
        });

        // Call authenticateCookie with a mock req and custom next
        const user = await new Promise((resolve, reject) => {
            const mockReq = { headers: { cookie }, ip: socket.handshake.address };
            const mockNext = (err) => (err ? reject(err) : resolve(mockReq.user));
            authenticateCookie(mockReq, {}, mockNext);
        });

        socket.user = user;
        logger.info(`WebSocket authentication successful for user: ${user.email}`, {
            socketID: socket.id,
            userID: user.userID,
            roles: user.roles?.join(', ') || 'None',
            timestamp: new Date().toISOString(),
        });
        next();
    } catch (error) {
        logger.error(`WebSocket authentication failed: ${error.message}`, {
            socketID: socket.id,
            ip: socket.handshake.address,
            origin: socket.handshake.headers.origin,
            referer: socket.handshake.headers.referer,
            headers: socket.handshake.headers,
            stack: error.stack,
            timestamp: new Date().toISOString(),
        });
        next(new Error(`Authentication failed: ${error.message}`));
    }
});

// Handle WebSocket connections
io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.user.email}`, {
        socketID: socket.id,
        userID: socket.user.userID,
        roles: socket.user.roles?.join(', ') || 'None',
        timestamp: new Date().toISOString(),
    });

    // Join role-based and user-specific rooms
    const roles = socket.user.roles || [];
    roles.forEach((role) => {
        socket.join(role.toLowerCase());
        logger.info(`User ${socket.user.email} joined room: ${role.toLowerCase()}`, {
            socketID: socket.id,
            userID: socket.user.userID,
            timestamp: new Date().toISOString(),
        });
    });
    socket.join(socket.user.userID);
    logger.info(`User ${socket.user.email} joined room: ${socket.user.userID}`, {
        socketID: socket.id,
        userID: socket.user.userID,
        timestamp: new Date().toISOString(),
    });

    // Handle join room
    socket.on('join', (room) => {
        socket.join(room);
        logger.info(`User ${socket.user.email} joined room: ${room}`, {
            socketID: socket.id,
            userID: socket.user.userID,
            timestamp: new Date().toISOString(),
        });
    });

    // Handle leave room
    socket.on('leave', (room) => {
        socket.leave(room);
        logger.info(`User ${socket.user.email} left room: ${room}`, {
            socketID: socket.id,
            userID: socket.user.userID,
            timestamp: new Date().toISOString(),
        });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
        logger.info(`User disconnected: ${socket.user.email}`, {
            socketID: socket.id,
            userID: socket.user.userID,
            reason,
            timestamp: new Date().toISOString(),
        });
    });
});

module.exports = io;