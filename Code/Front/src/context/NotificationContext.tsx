import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';
import Notification from '../models/Notification';
import { useAuth } from './AuthContext';
import { useError } from './ErrorContext'; // Import ErrorContext for global error handling
import { initSocket, joinRoom, onNotification, offNotification, disconnectSocket, isSocketConnected } from '../lib/socket';
import { markNotificationAsRead, getNotifications } from '../apis/notificationAPI';
import { useTranslation } from 'react-i18next';

interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
    toasts: Notification[];
}

type NotificationAction =
    | { type: 'ADD_NOTIFICATION'; payload: Notification }
    | { type: 'MARK_AS_READ'; payload: string }
    | { type: 'MARK_ALL_AS_READ' }
    | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
    | { type: 'MERGE_NOTIFICATIONS'; payload: Notification[] }
    | { type: 'ADD_TOAST'; payload: Notification }
    | { type: 'REMOVE_TOAST'; payload: string };

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    toasts: Notification[];
    addNotification: (notification: Notification) => void;
    markAsRead: (notificationID: string) => void;
    markAllAsRead: () => void;
    mergeNotifications: (notifications: Notification[]) => void;
    removeToast: (notificationID: string) => void;
    refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const initialState: NotificationState = {
    notifications: [],
    unreadCount: 0,
    toasts: [],
};

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes, matching AdminDashboard
interface CacheData {
    data: Notification[];
    timestamp: number;
}
const cache = new Map<string, CacheData>();

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
                toasts: state.toasts.filter((t) => t.notificationID !== action.payload),
                unreadCount: state.notifications.filter(
                    (n) => n.notificationID !== action.payload && n.status !== 'read' && n.channel === 'in-app'
                ).length,
            };
        case 'MARK_ALL_AS_READ':
            return {
                ...state,
                notifications: state.notifications.map((n) => ({ ...n, status: 'read' })),
                toasts: [],
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
        case 'ADD_TOAST':
            if (state.toasts.some((t) => t.notificationID === action.payload.notificationID)) {
                return state;
            }
            return {
                ...state,
                toasts: [action.payload, ...state.toasts],
            };
        case 'REMOVE_TOAST':
            return {
                ...state,
                toasts: state.toasts.filter((t) => t.notificationID !== action.payload),
            };
        default:
            return state;
    }
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(notificationReducer, initialState);
    const { user, userRoles, effectivePermissions } = useAuth();
    const { setError: setGlobalError, clearError } = useError();
    const { t } = useTranslation();

    const getCachedData = useCallback((key: string): Notification[] | null => {
        const cached = cache.get(key);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.data;
        }
        return null;
    }, []);

    const setCachedData = useCallback((key: string, data: Notification[]) => {
        cache.set(key, { data, timestamp: Date.now() });
    }, []);

    const fetchNotifications = useCallback(async () => {
        if (!user?.userID) return;
        try {
            let notificationsData = getCachedData('notifications');
            if (!notificationsData) {
                notificationsData = await getNotifications();
                setCachedData('notifications', notificationsData);
            }
            dispatch({ type: 'SET_NOTIFICATIONS', payload: notificationsData });
            clearError();
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
            const errorMessage = t('notification.error.fetchFailed');
            setGlobalError(errorMessage);
        }
    }, [user?.userID, getCachedData, setCachedData, setGlobalError, clearError, t]);

    const debouncedFetchNotifications = useCallback(debounce(fetchNotifications, 1000), [fetchNotifications]);

    const handleRefreshNotifications = useCallback(async () => {
        if (!effectivePermissions?.some((p) => p === import.meta.env.VITE_PERMISSIONS_VIEW_NOTIFICATION_RULES)) {
            const errorMessage = t('notification.error.noPermission');
            setGlobalError(errorMessage);
            return;
        }
        cache.delete('notifications');
        try {
            await fetchNotifications();
        } catch (error) {
            console.error('Failed to refresh notifications:', error);
            const errorMessage = t('notification.error.fetchFailed');
            setGlobalError(errorMessage);
        }
    }, [effectivePermissions, fetchNotifications, setGlobalError, t]);

    const setupWebSocket = useCallback(() => {
        if (!user?.userID || !userRoles) return () => { };

        if (!isSocketConnected()) initSocket();

        const handleNotificationEvent = (event: string, data: unknown) => {
            console.log(`Received notification event: ${event}`, { data });
            if (typeof data !== 'object' || !data) return;

            const notification = 'data' in data ? (data as { data: Notification }).data : (data as Notification);
            if (!notification.notificationID || notification.userID !== user.userID) return;

            if (event === 'notification:created' && notification.channel === 'in-app') {
                dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
                dispatch({ type: 'ADD_TOAST', payload: notification });
            } else if (event === 'notification:updated' && notification.status === 'read') {
                dispatch({ type: 'MARK_AS_READ', payload: notification.notificationID });
            } else if (event === 'notification:read') {
                dispatch({ type: 'MARK_AS_READ', payload: notification.notificationID });
            } else if (event.includes(':created') || event.includes(':updated') || event.includes(':deleted')) {
                debouncedFetchNotifications();
            }
        };

        onNotification(handleNotificationEvent);

        const joinRooms = () => {
            joinRoom(user.userID);
            joinRoom('default-roles-traceflow');
            userRoles.forEach((role) => joinRoom(role.name.toLowerCase()));
            if (effectivePermissions?.some((p) => p === import.meta.env.VITE_PERMISSIONS_VIEW_NOTIFICATION_RULES)) {
                joinRoom('notification');
            }
        };

        joinRooms();

        return () => {
            offNotification();
            disconnectSocket();
        };
    }, [user?.userID, userRoles, effectivePermissions, debouncedFetchNotifications]);

    useEffect(() => {
        const cleanup = setupWebSocket();
        fetchNotifications();
        return cleanup;
    }, [setupWebSocket, fetchNotifications]);

    const addNotification = (notification: Notification) => {
        dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
        if (notification.channel === 'in-app') {
            dispatch({ type: 'ADD_TOAST', payload: notification });
        }
    };

    const markAsRead = async (notificationID: string) => {
        try {
            await markNotificationAsRead(notificationID);
            dispatch({ type: 'MARK_AS_READ', payload: notificationID });
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
            const errorMessage = t('notification.error.markAsReadFailed');
            setGlobalError(errorMessage);
        }
    };

    const markAllAsRead = async () => {
        try {
            const unread = state.notifications.filter((n) => n.status !== 'read');
            await Promise.all(unread.map((n) => markNotificationAsRead(n.notificationID)));
            dispatch({ type: 'MARK_ALL_AS_READ' });
        } catch (error) {
            console.error('Failed to mark all as read:', error);
            const errorMessage = t('notification.error.markAllAsReadFailed');
            setGlobalError(errorMessage);
        }
    };

    const mergeNotifications = (notifications: Notification[]) => {
        dispatch({ type: 'MERGE_NOTIFICATIONS', payload: notifications });
    };

    const removeToast = (notificationID: string) => {
        dispatch({ type: 'REMOVE_TOAST', payload: notificationID });
    };

    return (
        <NotificationContext.Provider
            value={{
                notifications: state.notifications,
                unreadCount: state.unreadCount,
                toasts: state.toasts,
                addNotification,
                markAsRead,
                markAllAsRead,
                mergeNotifications,
                removeToast,
                refreshNotifications: handleRefreshNotifications,
            }}
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