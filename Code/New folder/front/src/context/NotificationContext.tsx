import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';
import Notification from '../models/Notification';
import { useAuth } from './AuthContext';
import { initSocket, joinRoom, leaveRoom, onNotification, offNotification, disconnectSocket, isSocketConnected, getSocket, reconnectSocket } from '../lib/socket';
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
            if (state.notifications.some((n) => n.notificationID === action.payload.notificationID)) {
                console.log('[NotificationContext] Skipping duplicate notification:', {
                    notificationID: action.payload.notificationID,
                    timestamp: new Date().toISOString(),
                });
                return state;
            }
            console.log('[NotificationContext] Adding notification to state:', {
                notificationID: action.payload.notificationID,
                userID: action.payload.userID,
                message: action.payload.message,
                type: action.payload.type,
                channel: action.payload.channel,
                timestamp: new Date().toISOString(),
            });
            return {
                ...state,
                notifications: [action.payload, ...state.notifications],
                unreadCount:
                    state.unreadCount +
                    (action.payload.status !== 'read' && action.payload.channel === 'in-app' ? 1 : 0),
            };
        case 'MARK_AS_READ':
            console.log('[NotificationContext] Marking notification as read:', {
                notificationID: action.payload,
                timestamp: new Date().toISOString(),
            });
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
            console.log('[NotificationContext] Marking all notifications as read:', {
                timestamp: new Date().toISOString(),
            });
            return {
                ...state,
                notifications: state.notifications.map((n) => ({ ...n, status: 'read' })),
                unreadCount: 0,
            };
        case 'SET_NOTIFICATIONS':
            console.log('[NotificationContext] Setting notifications:', {
                count: action.payload.length,
                unread: action.payload.filter((n) => n.status !== 'read' && n.channel === 'in-app').length,
                notificationIDs: action.payload.map((n) => n.notificationID),
                userIDs: action.payload.map((n) => n.userID),
                timestamp: new Date().toISOString(),
            });
            return {
                ...state,
                notifications: action.payload.sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                ),
                unreadCount: action.payload.filter((n) => n.status !== 'read' && n.channel === 'in-app').length,
            };
        case 'MERGE_NOTIFICATIONS': {
            console.log('[NotificationContext] Merging notifications:', {
                count: action.payload.length,
                notificationIDs: action.payload.map((n) => n.notificationID),
                userIDs: action.payload.map((n) => n.userID),
                timestamp: new Date().toISOString(),
            });
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
        }
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
            console.log('[NotificationContext] Fetching notifications for user:', {
                userID: user.userID,
                timestamp: new Date().toISOString(),
            });
            const fetchedNotifications = await getNotifications();
            console.log('[NotificationContext] Fetch response:', {
                count: fetchedNotifications.length,
                notificationIDs: fetchedNotifications.map((n) => n.notificationID),
                userIDs: fetchedNotifications.map((n) => n.userID),
                timestamp: new Date().toISOString(),
            });
            if (fetchedNotifications.length === 0) {
                console.warn('[NotificationContext] No notifications fetched', {
                    userID: user.userID,
                    timestamp: new Date().toISOString(),
                });
            }
            dispatch({ type: 'SET_NOTIFICATIONS', payload: fetchedNotifications });
        } catch (error) {
            console.error('[NotificationContext] Failed to fetch notifications:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userID: user.userID,
                timestamp: new Date().toISOString(),
            });
        }
    }, [user?.userID]);

    const debouncedFetchNotifications = useCallback(
        debounce(fetchNotifications, 1000, { leading: true, trailing: false }),
        [fetchNotifications]
    );

    const joinRooms = useCallback(() => {
        if (!user?.userID) return;
        console.log('[NotificationContext] Joining rooms for user:', {
            userID: user.userID,
            roles: userRoles?.map((r) => r.name) || [],
            timestamp: new Date().toISOString(),
        });
        joinRoom(user.userID);
        joinRoom('default-roles-traceflow');
        if (userRoles?.length) {
            userRoles.forEach((role) => {
                const room = role.name.toLowerCase();
                joinRoom(room);
                console.log('[NotificationContext] Joined room:', {
                    room,
                    timestamp: new Date().toISOString(),
                });
            });
        }
    }, [user?.userID, userRoles]);

    const setupWebSocket = useCallback(() => {
        if (!user?.userID || !userRoles) {
            console.log('[NotificationContext] Skipping WebSocket setup: missing user or roles', {
                userID: user?.userID,
                hasRoles: !!userRoles,
                timestamp: new Date().toISOString(),
            });
            return () => { };
        }

        console.log('[NotificationContext] Initializing WebSocket for user:', {
            userID: user.userID,
            roles: userRoles.map((r) => r.name),
            timestamp: new Date().toISOString(),
        });

        if (!isSocketConnected()) {
            initSocket();
        }

        const socket = getSocket();
        if (!socket) {
            console.error('[NotificationContext] Socket not initialized', {
                timestamp: new Date().toISOString(),
            });
            return () => { };
        }

        const handleConnect = async () => {
            console.log('[NotificationContext] WebSocket connected, setting up listeners', {
                socketId: socket.id,
                timestamp: new Date().toISOString(),
            });

            await onNotification((event: string, data: unknown) => {
                console.log('[NotificationContext] Received WebSocket event:', {
                    event,
                    rawData: JSON.stringify(data),
                    userID: user.userID,
                    timestamp: new Date().toISOString(),
                });

                if (event === 'notification:created' && typeof data === 'object' && data) {
                    let notification: Notification;
                    if ('data' in data && typeof data.data === 'object' && data.data) {
                        notification = data.data as Notification;
                    } else {
                        notification = data as Notification;
                    }

                    if (!notification.notificationID || !notification.userID) {
                        console.error('[NotificationContext] Invalid notification data:', {
                            event,
                            data: JSON.stringify(data),
                            timestamp: new Date().toISOString(),
                        });
                        return;
                    }

                    if (notification.userID !== user.userID) {
                        console.log('[NotificationContext] Skipping notification for different user:', {
                            event,
                            notificationUserID: notification.userID,
                            currentUserID: user.userID,
                            timestamp: new Date().toISOString(),
                        });
                        return;
                    }

                    if (notification.channel === 'in-app') {
                        console.log('[NotificationContext] Processing WebSocket notification:', {
                            event,
                            notificationID: notification.notificationID,
                            userID: notification.userID,
                            message: notification.message,
                            type: notification.type,
                            channel: notification.channel,
                            timestamp: new Date().toISOString(),
                        });
                        dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
                    } else {
                        console.log('[NotificationContext] Skipping notification: not in-app:', {
                            event,
                            notificationUserID: notification.userID,
                            channel: notification.channel,
                            timestamp: new Date().toISOString(),
                        });
                    }
                } else if (event === 'notification:updated' && typeof data === 'object' && data) {
                    let updateData: { notificationID: string; status: string };
                    if ('data' in data && typeof data.data === 'object' && data.data) {
                        updateData = data.data as { notificationID: string; status: string };
                    } else {
                        updateData = data as { notificationID: string; status: string };
                    }
                    if (updateData.status === 'read') {
                        console.log('[NotificationContext] Processing notification update:', {
                            notificationID: updateData.notificationID,
                            status: updateData.status,
                            timestamp: new Date().toISOString(),
                        });
                        dispatch({ type: 'MARK_AS_READ', payload: updateData.notificationID });
                    }
                } else if (event.includes(':created') || event.includes(':updated') || event.includes(':deleted')) {
                    console.log('[NotificationContext] Processing entity-specific event:', {
                        event,
                        data: JSON.stringify(data),
                        timestamp: new Date().toISOString(),
                    });
                    debouncedFetchNotifications();
                } else {
                    console.warn('[NotificationContext] Unhandled WebSocket event or invalid data:', {
                        event,
                        data: JSON.stringify(data),
                        timestamp: new Date().toISOString(),
                    });
                }
            });

            console.log('[NotificationContext] Listeners registered, joining rooms', {
                timestamp: new Date().toISOString(),
            });
            joinRooms();
            await fetchNotifications();
        };

        if (isSocketConnected()) {
            handleConnect();
        } else {
            socket.once('connect', handleConnect);
        }

        const handleTokenRefresh = () => {
            console.log('[NotificationContext] Reconnecting WebSocket due to token refresh', {
                timestamp: new Date().toISOString(),
            });
            reconnectSocket();
        };

        const handleSocketFailure = () => {
            console.log('[NotificationContext] WebSocket connection failed, attempting reconnect', {
                timestamp: new Date().toISOString(),
            });
            reconnectSocket();
        };

        window.addEventListener('tokenRefreshed', handleTokenRefresh);
        window.addEventListener('socketConnectionFailed', handleSocketFailure);

        return () => {
            console.log('[NotificationContext] Cleaning up WebSocket for user:', {
                userID: user?.userID,
                timestamp: new Date().toISOString(),
            });
            window.removeEventListener('tokenRefreshed', handleTokenRefresh);
            window.removeEventListener('socketConnectionFailed', handleSocketFailure);
            if (user?.userID) {
                leaveRoom(user.userID);
                leaveRoom('default-roles-traceflow');
                if (userRoles?.length) {
                    userRoles.forEach((role) => leaveRoom(role.name.toLowerCase()));
                }
            }
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
            console.error('[NotificationContext] Failed to mark notification as read:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                notificationID,
                timestamp: new Date().toISOString(),
            });
        }
    };

    const markAllAsRead = async () => {
        try {
            const unreadNotifications = state.notifications.filter((n) => n.status !== 'read');
            await Promise.all(unreadNotifications.map((n) => markNotificationAsRead(n.notificationID)));
            dispatch({ type: 'MARK_ALL_AS_READ' });
        } catch (error) {
            console.error('[NotificationContext] Failed to mark all notifications as read:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            });
        }
    };

    const mergeNotifications = (notifications: Notification[]) => {
        dispatch({ type: 'MERGE_NOTIFICATIONS', payload: notifications });
    };

    return (
        <NotificationContext.Provider
            value={{
                notifications: state.notifications,
                unreadCount: state.unreadCount,
                addNotification,
                markAsRead,
                markAllAsRead,
                mergeNotifications,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};