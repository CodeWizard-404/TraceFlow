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
    const role = socket.user.role.toLowerCase();
    socket.join(role);
    socket.join(socket.user.userID); // Join user-specific room
    console.log(`${new Date().toISOString()} - User ${socket.user.email} joined rooms: ${role}, ${socket.user.userID}`);

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`${new Date().toISOString()} - User disconnected: ${socket.user.email}`);
    });
});

module.exports = io;