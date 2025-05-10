const { Server } = require('socket.io');
const axios = require('axios');
const { User } = require('../models');
require('dotenv').config();

// Environment variables for Keycloak configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || '';

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
        // Step 1: Extract the cookie from the handshake headers
        const cookie = socket.handshake.headers.cookie;
        if (!cookie) {
            return next(new Error('No cookie provided'));
        }

        // Parse cookies and find the accessToken
        const cookies = cookie.split(';').map(c => c.trim());
        const tokenCookie = cookies.find(c => c.startsWith('accessToken='));
        if (!tokenCookie) {
            return next(new Error('accessToken cookie not found'));
        }
        const accessToken = tokenCookie.split('=')[1];

        let userData;

        // Step 2: Handle Google tokens (if applicable)
        if (accessToken.startsWith('google_')) {
            userData = {
                userID: 'temp_google_user',
                email: 'temp@google.com',
                roles: ['Supervisor'],
            };
        } else {
            // Step 3: Validate Keycloak token using the introspection endpoint
            const response = await axios.post(
                `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token/introspect`,
                new URLSearchParams({
                    token: accessToken,
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                })
            );

            // Check if the token is active
            if (!response.data.active) {
                return next(new Error('Invalid or expired token'));
            }

            // Step 4: Retrieve user from the local database
            const keycloakId = response.data.sub;
            const user = await User.findOne({ where: { keycloakId } });
            if (!user) {
                return next(new Error('User not found in local database'));
            }

            // Step 5: Prepare user data
            userData = {
                userID: user.userID,
                email: response.data.email,
                roles: response.data.realm_access?.roles || [],
                token: accessToken,
            };
        }

        // Step 6: Assign user data to the socket
        socket.user = userData;
        next();
    } catch (error) {
        // Step 7: Handle errors
        return next(new Error(`Authentication failed: ${error.message}`));
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