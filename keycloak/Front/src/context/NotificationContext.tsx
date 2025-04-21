import React, { createContext, useContext, useReducer, useEffect } from 'react';
import Notification from '../models/Notification';
import { useAuth } from './AuthContext';
import { initSocket, joinRoom, leaveRoom, onNotification, offNotification, disconnectSocket } from '../lib/socket';

// Define the shape of a notification
interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
}

// Define actions for the reducer
type NotificationAction =
    | { type: 'ADD_NOTIFICATION'; payload: Notification }
    | { type: 'MARK_AS_READ'; payload: string }
    | { type: 'MARK_ALL_AS_READ' }
    | { type: 'SET_NOTIFICATIONS'; payload: Notification[] };

// Create the context
interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (notification: Notification) => void;
    markAsRead: (notificationID: string) => void;
    markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Initial state for the reducer
const initialState: NotificationState = {
    notifications: [],
    unreadCount: 0,
};

// Reducer to manage notification state
const notificationReducer = (state: NotificationState, action: NotificationAction): NotificationState => {
    switch (action.type) {
        case 'ADD_NOTIFICATION':
            return {
                ...state,
                notifications: [action.payload, ...state.notifications],
                unreadCount: state.unreadCount + 1,
            };
        case 'MARK_AS_READ':
            return {
                ...state,
                notifications: state.notifications.map((n) =>
                    n.notificationID === action.payload ? { ...n, status: 'read' } : n
                ),
                unreadCount: state.notifications.filter(
                    (n) => n.notificationID !== action.payload && n.status !== 'read'
                ).length,
            };
        case 'MARK_ALL_AS_READ':
            return {
                ...state,
                notifications: state.notifications.map((n) => ({ ...n, status: 'read' })),
                unreadCount: 0,
            };
        case 'SET_NOTIFICATIONS':
            return {
                ...state,
                notifications: action.payload,
                unreadCount: action.payload.filter((n) => n.status !== 'read').length,
            };
        default:
            return state;
    }
};

// Type guard to check if data has a message property
const isNotificationData = (data: unknown): data is { message?: string } => {
    return typeof data === 'object' && data !== null && 'message' in data;
};

// Provider component to wrap the app
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(notificationReducer, initialState);
    const { user } = useAuth();

    // Listen for WebSocket notifications when the user is authenticated and accessToken cookie is present
    useEffect(() => {
        if (!user?.userID || !document.cookie.includes('accessToken')) {
            return;
        }

        // Initialize socket
        initSocket();

        // Join user-specific and role-based rooms
        joinRoom(user.userID);
        user.Roles?.forEach((role) => joinRoom(role.name.toLowerCase()));

        // Handle incoming notifications
        onNotification((event: string, data: unknown) => {
            const notification: Notification = {
                notificationID: `notif_${Date.now()}`,
                userID: user.userID,
                type: event.split(':')[0] as Notification['type'],
                message: isNotificationData(data) ? data.message || `Received ${event}` : `Received ${event}`,
                status: 'pending',
                channel: 'websocket',
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
        });

        // Handle token refresh to reconnect WebSocket
        const handleTokenRefresh = () => {
            disconnectSocket();
            initSocket();
            joinRoom(user.userID);
            user.Roles?.forEach((role) => joinRoom(role.name.toLowerCase()));
        };

        window.addEventListener('tokenRefreshed', handleTokenRefresh);

        // Cleanup WebSocket listeners
        return () => {
            leaveRoom(user.userID);
            user.Roles?.forEach((role) => leaveRoom(role.name.toLowerCase()));
            offNotification();
            disconnectSocket();
            window.removeEventListener('tokenRefreshed', handleTokenRefresh);
        };
    }, [user]);

    // Actions to interact with notifications
    const addNotification = (notification: Notification) => {
        dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
    };

    const markAsRead = (notificationID: string) => {
        dispatch({ type: 'MARK_AS_READ', payload: notificationID });
    };

    const markAllAsRead = () => {
        dispatch({ type: 'MARK_ALL_AS_READ' });
    };

    return (
        <NotificationContext.Provider
            value={{
                notifications: state.notifications,
                unreadCount: state.unreadCount,
                addNotification,
                markAsRead,
                markAllAsRead,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
};

// Hook to use the notification context
// eslint-disable-next-line react-refresh/only-export-components
export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};