const { Server } = require('socket.io');
const { authenticateCookie } = require('../config/security');
const logger = require('./logger');

// Initialize Socket.IO server
const io = new Server({
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// Middleware to authenticate WebSocket connections
io.use(async (socket, next) => {
    try {
        const cookie = socket.handshake.headers.cookie;
        if (!cookie) {
            throw new Error('No cookie provided');
        }

        const user = await new Promise((resolve, reject) => {
            authenticateCookie(
                { headers: { cookie }, ip: socket.handshake.address },
                { json: () => { } },
                (err) => (err ? reject(err) : resolve(socket.request.user))
            );
        });

        socket.user = user;
        next();
    } catch (error) {
        logger.error(`Socket authentication error: ${error.message}`);
        next(new Error('Authentication failed'));
    }
});

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log(`${new Date().toISOString()} - User connected: ${socket.user.email}`);

    // Join role-based and user-specific rooms
    const roles = socket.user.roles || [];
    roles.forEach((role) => {
        socket.join(role.toLowerCase());
        console.log(`${new Date().toISOString()} - User ${socket.user.email} joined room: ${role.toLowerCase()}`);
    });
    socket.join(socket.user.userID);
    console.log(`${new Date().toISOString()} - User ${socket.user.email} joined room: ${socket.user.userID}`);

    // Handle join room
    socket.on('join', (room) => {
        socket.join(room);
        console.log(`${new Date().toISOString()} - User ${socket.user.email} joined room: ${room}`);
    });

    // Handle leave room
    socket.on('leave', (room) => {
        socket.leave(room);
        console.log(`${new Date().toISOString()} - User ${socket.user.email} left room: ${room}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`${new Date().toISOString()} - User disconnected: ${socket.user.email}`);
    });
});

module.exports = io;