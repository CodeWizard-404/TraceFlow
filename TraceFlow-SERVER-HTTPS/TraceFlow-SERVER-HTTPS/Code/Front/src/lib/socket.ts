import { io, Socket } from 'socket.io-client';
import { getNotificationEvents, NotificationEvent } from './notifEvents';
import { refreshToken } from '../apis/authAPI';

const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.14:5000';
let socket: Socket | null = null;

export const initSocket = (retryCount = 5, retryDelay = 2000) => {
    if (socket && socket.connected) {
        console.log('Socket already connected', { socketId: socket?.id });
        return socket;
    }

    const connect = (attempt = 1, useProxy = true) => {
        const url = useProxy ? '/' : API_URL;
        socket = io(url, {
            withCredentials: true,
            transports: ['websocket'],
            reconnection: false,
            extraHeaders: {
                Cookie: document.cookie,
            },
        });

        socket.on('connect', () => {
            console.log('Connected to WebSocket', { socketId: socket?.id });
            joinRoom('default-roles-traceflow');
        });

        socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', { message: error.message, attempt });
            if (error.message.includes('Authentication failed') || error.message.includes('Invalid token')) {
                refreshToken()
                    .then(() => reconnectSocket())
                    .catch(() => (window.location.href = '/login'));
                return;
            }
            if (attempt < retryCount) {
                const delay = retryDelay * Math.pow(2, attempt - 1);
                setTimeout(() => connect(attempt + 1, attempt === retryCount - 1 ? false : useProxy), delay);
            } else {
                window.dispatchEvent(new Event('socketConnectionFailed'));
            }
        });

        socket.on('disconnect', (reason) => {
            console.log('Disconnected from WebSocket', { reason });
        });
    };

    connect();
    return socket;
};

export const reconnectSocket = () => {
    if (socket) {
        disconnectSocket();
        initSocket();
    } else {
        initSocket();
    }
};

export const joinRoom = (room: string, retries = 3, delay = 1000) => {
    if (socket && socket.connected) {
        socket.emit('join', room);
        console.log(`Joined room: ${room}`);
    } else if (retries > 0) {
        setTimeout(() => joinRoom(room, retries - 1, delay * 2), delay);
    } else {
        console.error(`Failed to join room ${room}: Max retries reached`);
    }
};

export const leaveRoom = (room: string) => {
    if (socket && socket.connected) {
        socket.emit('leave', room);
        console.log(`Left room: ${room}`);
    }
};

export const onNotification = async (callback: (event: NotificationEvent, data: unknown) => void) => {
    if (!socket) socket = initSocket();

    const registerListeners = async () => {
        if (!socket) return;

        const events = await getNotificationEvents();
        events.forEach((event) => {
            socket!.on(event, (data) => {
                console.log(`Received event: ${event}`, { data });
                callback(event, data);
            });
        });

        // Handle Redis Pub/Sub notifications
        socket!.on('notification', (data) => {
            console.log('Received Redis Pub/Sub notification:', { data });
            if (data?.event) callback(data.event, data.data);
        });
    };

    if (socket!.connected) {
        await registerListeners();
    } else {
        socket!.once('connect', registerListeners);
    }
};

export const offNotification = () => {
    if (socket) socket.removeAllListeners();
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

export const getSocket = () => socket;

export const isSocketConnected = () => socket?.connected || false;