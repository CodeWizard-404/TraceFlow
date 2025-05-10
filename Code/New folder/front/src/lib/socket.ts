import { io, Socket } from 'socket.io-client';
import { getNotificationEvents, NotificationEvent } from './notifEvents';
import { refreshToken } from '../apis/authAPI';

const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.14:5000';
let socket: Socket | null = null;

export const initSocket = (retryCount = 5, retryDelay = 2000) => {
    if (socket && socket.connected) {
        console.log('Socket already connected, skipping initialization', {
            socketId: socket?.id,
            timestamp: new Date().toISOString(),
        });
        return socket;
    }

    const connect = (attempt = 1, useProxy = true) => {
        const url = useProxy ? '/' : API_URL;
        console.log(`Attempting WebSocket connection (Attempt ${attempt}/${retryCount})`, {
            url,
            cookies: document.cookie,
            useProxy,
            timestamp: new Date().toISOString(),
        });

        socket = io(url, {
            withCredentials: true,
            transports: ['websocket'],
            reconnection: false, // Handle reconnection manually
            extraHeaders: {
                Cookie: document.cookie, // Explicitly pass cookies for Redis session validation
            },
        });

        socket.on('connect', () => {
            console.log('Connected to WebSocket server', {
                socketId: socket?.id,
                timestamp: new Date().toISOString(),
            });
            joinRoom('default-roles-traceflow');
        });

        socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', {
                message: error.message,
                attempt,
                useProxy,
                timestamp: new Date().toISOString(),
            });

            if (error.message.includes('Authentication failed') ||
                error.message.includes('Invalid or expired session') ||
                error.message.includes('Invalid token')) {
                console.warn('Authentication error detected, triggering token refresh', {
                    attempt,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                });
                refreshToken().then(() => reconnectSocket()).catch(() => {
                    window.location.href = '/login';
                });
                return;
            }

            if (attempt < retryCount) {
                const newDelay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                console.log(`Retrying WebSocket connection in ${newDelay}ms`, {
                    attempt: attempt + 1,
                    useProxy: attempt === retryCount - 1 ? false : useProxy,
                    timestamp: new Date().toISOString(),
                });
                setTimeout(() => connect(attempt + 1, attempt === retryCount - 1 ? false : useProxy), newDelay);
            } else {
                console.error('Max WebSocket connection attempts reached.', {
                    timestamp: new Date().toISOString(),
                });
                window.dispatchEvent(new Event('socketConnectionFailed'));
            }
        });

        socket.on('disconnect', (reason) => {
            console.log('Disconnected from WebSocket server', {
                reason,
                timestamp: new Date().toISOString(),
            });
        });
    };

    connect();
    return socket;
};

export const reconnectSocket = () => {
    if (socket) {
        console.log('Initiating WebSocket reconnection', { timestamp: new Date().toISOString() });
        disconnectSocket();
        initSocket();
    } else {
        console.log('No socket instance, initializing new socket', { timestamp: new Date().toISOString() });
        initSocket();
    }
};

export const joinRoom = (room: string, retries = 3, delay = 1000) => {
    if (socket && socket.connected) {
        socket.emit('join', room);
        console.log(`Joined room: ${room}`, { timestamp: new Date().toISOString() });
    } else {
        console.warn(`Cannot join room ${room}: Socket not connected`, { timestamp: new Date().toISOString() });
        if (retries > 0) {
            console.log(`Retrying join room ${room} in ${delay}ms`, {
                retriesLeft: retries - 1,
                timestamp: new Date().toISOString(),
            });
            setTimeout(() => joinRoom(room, retries - 1, delay * 2), delay);
        } else {
            console.error(`Failed to join room ${room}: Max retries reached`, { timestamp: new Date().toISOString() });
        }
    }
};

export const leaveRoom = (room: string) => {
    if (socket && socket.connected) {
        socket.emit('leave', room);
        console.log(`Left room: ${room}`, { timestamp: new Date().toISOString() });
    }
};

export const onNotification = async (callback: (event: NotificationEvent, data: unknown) => void) => {
    if (!socket) {
        console.warn('[WebSocket] Cannot listen: Socket not initialized', {
            timestamp: new Date().toISOString(),
        });
        socket = initSocket();
    }

    const registerListeners = async (retries = 3, delay = 1000) => {
        if (!socket) {
            console.error('[WebSocket] Socket still not initialized after initSocket', {
                timestamp: new Date().toISOString(),
            });
            return;
        }

        socket.onAny((event, data) => {
            console.log('[WebSocket] Received ANY event:', {
                event,
                data,
                timestamp: new Date().toISOString(),
            });
        });

        try {
            const events = await getNotificationEvents();
            console.log('[WebSocket] Registering listeners for events:', {
                events,
                timestamp: new Date().toISOString(),
            });

            events.forEach((event) => {
                socket!.on(event, (data) => {
                    console.log(`[WebSocket] Received event: ${event}`, {
                        data,
                        timestamp: new Date().toISOString(),
                    });
                    callback(event, data);
                });
            });

            // Explicitly register notification events
            socket!.on('notification:created', (data) => {
                console.log('[WebSocket] Received notification:created:', {
                    data,
                    timestamp: new Date().toISOString(),
                });
                callback('notification:created', data);
            });

            socket!.on('notification:updated', (data) => {
                console.log('[WebSocket] Received notification:updated:', {
                    data,
                    timestamp: new Date().toISOString(),
                });
                callback('notification:updated', data);
            });
        } catch (error) {
            console.error('[WebSocket] Failed to fetch notification events:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            });
            if (retries > 0) {
                console.log(`Retrying listener registration in ${delay}ms`, {
                    retriesLeft: retries - 1,
                    timestamp: new Date().toISOString(),
                });
                setTimeout(() => registerListeners(retries - 1, delay * 2), delay);
            } else {
                console.error('[WebSocket] Max retries reached for listener registration', {
                    timestamp: new Date().toISOString(),
                });
            }
        }
    };

    if (socket!.connected) {
        console.log('[WebSocket] Socket connected, registering listeners immediately', {
            timestamp: new Date().toISOString(),
        });
        await registerListeners();
    } else {
        console.log('[WebSocket] Waiting for socket connection to register listeners', {
            timestamp: new Date().toISOString(),
        });
        socket!.once('connect', async () => {
            console.log('[WebSocket] Socket connected, registering listeners', {
                timestamp: new Date().toISOString(),
            });
            await registerListeners();
        });
    }
};

export const offNotification = () => {
    if (socket) {
        socket.removeAllListeners();
        console.log('Removed all WebSocket event listeners', { timestamp: new Date().toISOString() });
    }
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
        console.log('Socket disconnected', { timestamp: new Date().toISOString() });
    }
};

export const getSocket = () => socket;

export const isSocketConnected = () => {
    return socket?.connected || false;
};