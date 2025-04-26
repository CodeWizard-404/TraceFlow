import { io, Socket } from 'socket.io-client';
import { getNotificationEvents, NotificationEvent } from './notifEvents';

// Get the API URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.14:5000';

// Initialize the Socket.IO client
let socket: Socket | null = null;

// Connect to the WebSocket server (authentication via cookies)
export const initSocket = (retryCount = 3, retryDelay = 2000) => {
    if (socket && socket.connected) {
        console.debug('Socket already connected, skipping initialization', {
            socketId: socket?.id,
            timestamp: new Date().toISOString(),
        });
        return socket;
    }

    const connect = (attempt = 1, useProxy = true) => {
        const url = useProxy ? '/' : API_URL;
        console.debug(`Attempting WebSocket connection (Attempt ${attempt}/${retryCount})`, {
            url,
            useProxy,
            timestamp: new Date().toISOString(),
        });

        socket = io(url, {
            withCredentials: true,
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
        });

        socket.on('connect', () => {
            console.debug('Connected to WebSocket server', {
                socketId: socket?.id,
                timestamp: new Date().toISOString(),
            });
        });

        socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', {
                message: error.message,
                attempt,
                useProxy,
                timestamp: new Date().toISOString(),
            });

            if (error.message.includes('ECONNRESET') || error.message.includes('ECONNREFUSED')) {
                console.warn('Network error detected, increasing retry delay', {
                    attempt,
                    timestamp: new Date().toISOString(),
                });
                retryDelay = 5000; // Increase delay for network issues
            }

            if (attempt < retryCount) {
                console.debug(`Retrying WebSocket connection in ${retryDelay}ms`, {
                    attempt: attempt + 1,
                    useProxy: attempt === retryCount - 1 ? false : useProxy,
                    timestamp: new Date().toISOString(),
                });
                setTimeout(() => connect(attempt + 1, attempt === retryCount - 1 ? false : useProxy), retryDelay);
            } else {
                console.error('Max WebSocket connection attempts reached. Please check logs and try again.', {
                    timestamp: new Date().toISOString(),
                });
                // Do not redirect to allow debugging
            }
        });

        socket.on('disconnect', (reason) => {
            console.debug('Disconnected from WebSocket server', {
                reason,
                timestamp: new Date().toISOString(),
            });
        });

        socket.on('reconnect', (attempt) => {
            console.debug('Reconnected to WebSocket server', {
                attempt,
                socketId: socket?.id,
                timestamp: new Date().toISOString(),
            });
        });

        socket.on('reconnect_error', (error) => {
            console.error('WebSocket reconnection error:', {
                message: error.message,
                timestamp: new Date().toISOString(),
            });
        });
    };

    setTimeout(() => connect(), 1000); // Delay to ensure cookies are set
    return socket;
};

// Join a room (e.g., userID or role like 'admin')
export const joinRoom = (room: string) => {
    if (socket && socket.connected) {
        socket.emit('join', room);
        console.debug(`Joined room: ${room}`, { timestamp: new Date().toISOString() });
    } else {
        console.warn(`Cannot join room ${room}: Socket not connected`, { timestamp: new Date().toISOString() });
    }
};

// Leave a room
export const leaveRoom = (room: string) => {
    if (socket && socket.connected) {
        socket.emit('leave', room);
        console.debug(`Left room: ${room}`, { timestamp: new Date().toISOString() });
    }
};

// Listen for notification events
export const onNotification = async (callback: (event: NotificationEvent, data: unknown) => void) => {
    if (socket) {
        const events = await getNotificationEvents();
        events.forEach((event) => {
            socket!.on(event, (data) => {
                console.debug(`Received WebSocket event: ${event}`, {
                    data,
                    timestamp: new Date().toISOString(),
                });
                callback(event, data);
            });
        });
    } else {
        console.warn('Cannot listen for notifications: Socket not initialized', { timestamp: new Date().toISOString() });
    }
};

// Stop listening for notifications
export const offNotification = () => {
    if (socket) {
        socket.removeAllListeners();
        console.debug('Removed all WebSocket event listeners', { timestamp: new Date().toISOString() });
    }
};

// Disconnect the socket
export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

// Get the socket instance
export const getSocket = () => socket;

// Check if socket is connected
export const isSocketConnected = () => {
    return socket?.connected || false;
};