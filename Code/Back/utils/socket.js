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

    try {
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
    } catch (error) {
        return next(new Error('Authentication error'));
    }
});

io.on('connection', async (socket) => {
    console.log('User connected:', socket.user.userID);

    try {
        // Set isOnline to true when user connects
        await User.update({ isOnline: true }, { where: { userID: socket.user.userID } });
        socket.join(socket.user.userID);

        socket.on('disconnect', async () => {
            console.log('User disconnected:', socket.user.userID);
            try {
                // Set isOnline to false when user disconnects
                await User.update({ isOnline: false }, { where: { userID: socket.user.userID } });
            } catch (error) {
                console.error('Error updating isOnline on disconnect:', error);
            }
        });

        socket.on('message', (message) => {
            socket.to(socket.user.userID).emit('message', message);
        });

        socket.on('join', (room) => socket.join(room));
        socket.on('leave', (room) => socket.leave(room));
    } catch (error) {
        console.error('Error handling connection:', error);
        socket.disconnect(true);
    }
});

module.exports = io;