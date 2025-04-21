import { io, Socket } from 'socket.io-client';

// Get the API URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Initialize the Socket.IO client
let socket: Socket | null = null;

// Connect to the WebSocket server (authentication via cookies)
export const initSocket = () => {
    if (!socket) {
        socket = io(API_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
            extraHeaders: {
                Cookie: document.cookie, // Ensure cookies are sent with the initial handshake
            },
        });

        socket.on('connect', () => {
            console.log('Connected to WebSocket server');
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket server');
        });

        socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error.message);
        });
    }
    return socket;
};

// Join a room (e.g., userID or role like 'admin')
export const joinRoom = (room: string) => {
    if (socket && socket.connected) {
        socket.emit('join', room);
        console.log(`Joined room: ${room}`);
    }
};

// Leave a room
export const leaveRoom = (room: string) => {
    if (socket && socket.connected) {
        socket.emit('leave', room);
        console.log(`Left room: ${room}`);
    }
};

// Listen for notification events
export const onNotification = (callback: (event: string, data: unknown) => void) => {
    if (socket) {
        // List of all backend notification events
        const events = [
            'user:created',
            'user:updated',
            'user:profile_updated',
            'user:deleted',
            'user:supervisors_assigned',
            'user:supervisors_revoked',
            'user:google_account_assigned',
            'role:created',
            'role:updated',
            'role:deleted',
            'role:assigned',
            'role:revoked',
            'role:reset',
            'permission:updated',
            'permission:assigned',
            'permission:revoked',
            'permission:override_added',
            'permission:override_removed',
            'timesheet:reminder',
            'otp:generated:user',
            'otp:generated:agent',
        ];

        events.forEach((event) => {
            socket!.on(event, (data) => callback(event, data));
        });
    }
};

// Stop listening for notifications
export const offNotification = () => {
    if (socket) {
        socket.removeAllListeners();
    }
};

// Disconnect the socket
export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
        console.log('Socket disconnected');
    }
};

// Get the socket instance
export const getSocket = () => socket;

// Check if socket is connected
export const isSocketConnected = () => {
    return socket?.connected || false;
};