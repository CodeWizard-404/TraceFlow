const { Server } = require('socket.io');
const { authenticateCookie } = require('../config/security');

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
            return next(new Error('No cookie provided'));
        }

        const cookies = cookie.split(';').map(c => c.trim());
        const tokenCookie = cookies.find(c => c.startsWith('accessToken='));
        if (!tokenCookie) {
            return next(new Error('accessToken cookie not found'));
        }

        const user = await new Promise((resolve, reject) => {
            const mockReq = { headers: { cookie }, ip: socket.handshake.address };
            const mockNext = (err) => (err ? reject(err) : resolve(mockReq.user));
            authenticateCookie(mockReq, {}, mockNext);
        });

        if (!user || !user.userID) {
            return next(new Error('Invalid user data'));
        }

        socket.user = user;
        next();
    } catch (error) {
        next(new Error(`Authentication failed: ${error.message}`));
    }
});

// Handle WebSocket connections
io.on('connection', (socket) => {

    // Join role-based and user-specific rooms
    const roles = socket.user.roles || [];
    roles.forEach((role) => {
        socket.join(role.toLowerCase());

    });
    socket.join(socket.user.userID);


    // Handle join room
    socket.on('join', (room) => {
        socket.join(room);

    });

    // Handle leave room
    socket.on('leave', (room) => {
        socket.leave(room);

    });

});

module.exports = io;