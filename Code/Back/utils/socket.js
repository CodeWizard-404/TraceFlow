const { Server } = require('socket.io');
const { authenticateCookie } = require('../config/security');
const logger = require('./logger');

// Initialize Socket.IO server
const io = new Server({
    cors: {
        origin: [
            process.env.FRONTEND_URL,
            process.env.FRONTEND_URL1,
        ],
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
        if (!cookie) {
            logger.error('No cookie provided in WebSocket handshake', {
                socketId: socket.id,
                timestamp: new Date().toISOString(),
            });
            return next(new Error('No cookie provided'));
        }

        const cookies = cookie.split(';').map(c => c.trim());
        const tokenCookie = cookies.find(c => c.startsWith('accessToken='));
        if (!tokenCookie) {
            logger.error('accessToken cookie not found in handshake', {
                socketId: socket.id,
                cookies,
                timestamp: new Date().toISOString(),
            });
            return next(new Error('accessToken cookie not found'));
        }

        const user = await new Promise((resolve, reject) => {
            const mockReq = { headers: { cookie }, ip: socket.handshake.address };
            const mockNext = (err) => (err ? reject(err) : resolve(mockReq.user));
            authenticateCookie(mockReq, {}, mockNext);
        });

        if (!user || !user.userID) {
            logger.error('Invalid user data after authentication', {
                socketId: socket.id,
                user,
                timestamp: new Date().toISOString(),
            });
            return next(new Error('Invalid user data'));
        }

        socket.user = user;
        logger.info('WebSocket authentication successful', {
            socketId: socket.id,
            userID: user.userID,
            email: user.email,
            roles: user.roles.join(', '),
            timestamp: new Date().toISOString(),
        });
        next();
    } catch (error) {
        logger.error(`WebSocket authentication failed: ${error.message}`, {
            socketId: socket.id,
            stack: error.stack,
            timestamp: new Date().toISOString(),
        });
        next(new Error(`Authentication failed: ${error.message}`));
    }
});

// Handle WebSocket connections
io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.user.email}`, {
        socketId: socket.id,
        userID: socket.user.userID,
        timestamp: new Date().toISOString(),
    });

    // Join role-based and user-specific rooms
    const roles = socket.user.roles || [];
    roles.forEach((role) => {
        socket.join(role.toLowerCase());
        // logger.info(`User ${socket.user.email} joined room: ${role.toLowerCase()}`, {
        //     socketId: socket.id,
        //     timestamp: new Date().toISOString(),
        // });
    });
    socket.join(socket.user.userID);
    // logger.info(`User ${socket.user.email} joined room: ${socket.user.userID}`, {
    //     socketId: socket.id,
    //     timestamp: new Date().toISOString(),
    // });

    // Handle join room
    socket.on('join', (room) => {
        socket.join(room);
        // logger.info(`User ${socket.user.email} joined room: ${room}`, {
        //     socketId: socket.id,
        //     timestamp: new Date().toISOString(),
        // });
    });

    // Handle leave room
    socket.on('leave', (room) => {
        socket.leave(room);
        // logger.info(`User ${socket.user.email} left room: ${room}`, {
        //     socketId: socket.id,
        //     timestamp: new Date().toISOString(),
        // });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
        logger.info(`User disconnected: ${socket.user.email}`, {
            socketId: socket.id,
            reason,
            timestamp: new Date().toISOString(),
        });
    });
});

module.exports = io;