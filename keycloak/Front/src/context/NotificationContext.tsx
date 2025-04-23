import React, { createContext, useContext, useReducer, useEffect } from 'react';
import Notification from '../models/Notification';
import { useAuth } from './AuthContext';
import { initSocket, joinRoom, leaveRoom, onNotification, offNotification, disconnectSocket } from '../lib/socket';
import { markNotificationAsRead } from '../apis/notificationAPI';

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
            if (state.notifications.some((n) => n.notificationID === action.payload.notificationID)) {
                return state;
            }
            return {
                ...state,
                notifications: [action.payload, ...state.notifications],
                unreadCount:
                    state.unreadCount +
                    (action.payload.status !== 'read' && action.payload.channel === 'in-app' ? 1 : 0),
            };
        case 'MARK_AS_READ':
            return {
                ...state,
                notifications: state.notifications.map((n) =>
                    n.notificationID === action.payload ? { ...n, status: 'read' } : n
                ),
                unreadCount: state.notifications.filter(
                    (n) =>
                        n.notificationID !== action.payload &&
                        n.status !== 'read' &&
                        n.channel === 'in-app'
                ).length,
            };
        case 'MARK_ALL_AS_READ':
            return {
                ...state,
                notifications: state.notifications.map((n) => ({ ...n, status: 'read' })),
                unreadCount: 0,
            };
        case 'SET_NOTIFICATIONS':
            {
                const uniqueNotifications = action.payload.reduce((acc, n) => {
                    if (!acc.some((existing) => existing.notificationID === n.notificationID)) {
                        acc.push(n);
                    }
                    return acc;
                }, [] as Notification[]);
                return {
                    ...state,
                    notifications: uniqueNotifications,
                    unreadCount: uniqueNotifications.filter(
                        (n) => n.status !== 'read' && n.channel === 'in-app'
                    ).length,
                };
            }
        default:
            return state;
    }
};

// Type guard to check if data has a message property
const isNotificationData = (data: unknown): data is { message?: string; notificationID?: string } => {
    return typeof data === 'object' && data !== null && ('message' in data || 'notificationID' in data);
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
                notificationID: isNotificationData(data) && data.notificationID
                    ? data.notificationID
                    : `notif_${crypto.randomUUID()}`,
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

    const markAsRead = async (notificationID: string) => {
        try {
            // Call API to mark notification as read
            await markNotificationAsRead(notificationID);
            // Update local state only if API call succeeds
            dispatch({ type: 'MARK_AS_READ', payload: notificationID });
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            // Option 1: Call API for each unread notification
            const unreadNotifications = state.notifications.filter(n => n.status !== 'read');
            await Promise.all(
                unreadNotifications.map(n => markNotificationAsRead(n.notificationID))
            );
            // Update local state
            dispatch({ type: 'MARK_ALL_AS_READ' });
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
        }
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
