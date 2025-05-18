import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';
import Notification from '../models/Notification';
import { useAuth } from './AuthContext';
import { initSocket, joinRoom, onNotification, offNotification, disconnectSocket, isSocketConnected } from '../lib/socket';
import { markNotificationAsRead, getNotifications } from '../apis/notificationAPI';

interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
}

type NotificationAction =
    | { type: 'ADD_NOTIFICATION'; payload: Notification }
    | { type: 'MARK_AS_READ'; payload: string }
    | { type: 'MARK_ALL_AS_READ' }
    | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
    | { type: 'MERGE_NOTIFICATIONS'; payload: Notification[] };

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (notification: Notification) => void;
    markAsRead: (notificationID: string) => void;
    markAllAsRead: () => void;
    mergeNotifications: (notifications: Notification[]) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const initialState: NotificationState = {
    notifications: [],
    unreadCount: 0,
};

const notificationReducer = (state: NotificationState, action: NotificationAction): NotificationState => {
    switch (action.type) {
        case 'ADD_NOTIFICATION':
            if (state.notifications.some((n) => n.notificationID === n.notificationID)) {
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
                    (n) => n.notificationID !== action.payload && n.status !== 'read' && n.channel === 'in-app'
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
                notifications: action.payload.sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                ),
                unreadCount: action.payload.filter((n) => n.status !== 'read' && n.channel === 'in-app').length,
            };
        case 'MERGE_NOTIFICATIONS':
            const existingIds = new Set(state.notifications.map((n) => n.notificationID));
            const newNotifications = action.payload.filter((n) => !existingIds.has(n.notificationID));
            return {
                ...state,
                notifications: [...newNotifications, ...state.notifications].sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                ),
                unreadCount: [...newNotifications, ...state.notifications].filter(
                    (n) => n.status !== 'read' && n.channel === 'in-app'
                ).length,
            };
        default:
            return state;
    }
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(notificationReducer, initialState);
    const { user, userRoles } = useAuth();

    const fetchNotifications = useCallback(async () => {
        if (!user?.userID) return;
        try {
            const fetchedNotifications = await getNotifications();
            dispatch({ type: 'SET_NOTIFICATIONS', payload: fetchedNotifications });
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    }, [user?.userID]);

    const debouncedFetchNotifications = useCallback(debounce(fetchNotifications, 1000), [fetchNotifications]);

    const joinRooms = useCallback(() => {
        if (!user?.userID || !userRoles) return;
        joinRoom(user.userID);
        joinRoom('default-roles-traceflow');
        userRoles.forEach((role) => joinRoom(role.name.toLowerCase()));
    }, [user?.userID, userRoles]);

    const setupWebSocket = useCallback(() => {
        if (!user?.userID || !userRoles) return () => { };

        if (!isSocketConnected()) initSocket();

        const handleNotification = (event: string, data: unknown) => {
            if (typeof data !== 'object' || !data) return;

            const notification = 'data' in data ? (data as { data: Notification }).data : (data as Notification);
            if (!notification.notificationID || notification.userID !== user.userID) return;

            if (notification.channel === 'in-app') {
                dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
            } else if (event === 'notification:updated' && (data as any).status === 'read') {
                dispatch({ type: 'MARK_AS_READ', payload: notification.notificationID });
            } else if (event.includes(':created') || event.includes(':updated') || event.includes(':deleted')) {
                debouncedFetchNotifications();
            }
        };

        onNotification(handleNotification);
        joinRooms();
        fetchNotifications();

        return () => {
            offNotification();
            disconnectSocket();
        };
    }, [user?.userID, userRoles, fetchNotifications, debouncedFetchNotifications, joinRooms]);

    useEffect(() => {
        const cleanup = setupWebSocket();
        return cleanup;
    }, [setupWebSocket]);

    const addNotification = (notification: Notification) => {
        dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
    };

    const markAsRead = async (notificationID: string) => {
        try {
            await markNotificationAsRead(notificationID);
            dispatch({ type: 'MARK_AS_READ', payload: notificationID });
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const unread = state.notifications.filter((n) => n.status !== 'read');
            await Promise.all(unread.map((n) => markNotificationAsRead(n.notificationID)));
            dispatch({ type: 'MARK_ALL_AS_READ' });
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const mergeNotifications = (notifications: Notification[]) => {
        dispatch({ type: 'MERGE_NOTIFICATIONS', payload: notifications });
    };

    return (
        <NotificationContext.Provider
            value={{ notifications: state.notifications, unreadCount: state.unreadCount, addNotification, markAsRead, markAllAsRead, mergeNotifications }}
        >
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotification must be used within a NotificationProvider');
    return context;
};