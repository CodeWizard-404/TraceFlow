const { Server } = require('socket.io');
const axios = require('axios');
const { User } = require('../models');
require('dotenv').config();

const io = new Server({
    cors: {
        origin: [process.env.FRONTEND_URL, process.env.FRONTEND_URL1],
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

io.use(async (socket, next) => {
    const accessToken = socket.handshake.headers.cookie?.match(/accessToken=([^;]+)/)?.[1];
    if (!accessToken) return next(new Error('No token'));

    const response = await axios.post(
        `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}/protocol/openid-connect/token/introspect`,
        new URLSearchParams({
            token: accessToken,
            client_id: process.env.KEYCLOAK_CLIENT_ID,
            client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
        })
    );

    if (!response.data.active) return next(new Error('Invalid token'));
    const user = await User.findOne({ where: { keycloakId: response.data.sub } });
    if (!user) return next(new Error('User not found'));

    socket.user = {
        userID: user.userID,
        email: response.data.email,
        roles: response.data.realm_access?.roles || [],
    };
    next();
});

io.on('connection', (socket) => {
    socket.join(socket.user.userID); // Only join user-specific room

    socket.on('join', (room) => socket.join(room));
    socket.on('leave', (room) => socket.leave(room));
    socket.on('disconnect', () => {
        socket.rooms.forEach((room) => socket.leave(room));
    });
});

module.exports = io;