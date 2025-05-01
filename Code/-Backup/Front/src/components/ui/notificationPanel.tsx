import React, { useEffect, useRef, useState } from 'react';
import { FaSync } from 'react-icons/fa';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import NotificationItem from './notification';
import { cn } from '../../lib/utils';
import './notification.css';
import { getNotifications } from '../../apis/notificationAPI';

interface NotificationPanelProps {
    className?: string;
    onClose?: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ className, onClose }) => {
    const { notifications, mergeNotifications } = useNotification();
    const { user } = useAuth();
    const panelRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        console.log('[NotificationPanel] Notifications updated:', {
            count: notifications.length,
            unread: notifications.filter((n) => n.status !== 'read').length,
            userID: user?.userID,
            notifications: notifications.map((n) => ({
                id: n.notificationID,
                message: n.message,
                status: n.status,
                type: n.type,
                channel: n.channel,
                userID: n.userID,
            })),
            timestamp: new Date().toISOString(),
        });

        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                if (onClose) onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [notifications, onClose, user?.userID]);

    // Filter only unread notifications
    const filteredNotifications = notifications
        .filter((n) => n.status !== 'read' && n.channel === 'in-app')
        .sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA; // Always sort by newest
        });

    const unreadCount = filteredNotifications.length;

    const handleRefresh = async () => {
        setIsLoading(true);
        try {
            console.log('[NotificationPanel] Refreshing notifications for user:', {
                userID: user?.userID,
                timestamp: new Date().toISOString(),
            });
            const fetchedNotifications = await getNotifications();
            console.log('[NotificationPanel] Fetched notifications:', {
                count: fetchedNotifications.length,
                notificationIDs: fetchedNotifications.map((n) => n.notificationID),
                userIDs: fetchedNotifications.map((n) => n.userID),
                notifications: fetchedNotifications.map((n) => ({
                    id: n.notificationID,
                    message: n.message,
                    status: n.status,
                    type: n.type,
                    channel: n.channel,
                    userID: n.userID,
                })),
                timestamp: new Date().toISOString(),
            });
            mergeNotifications(fetchedNotifications);
        } catch (error) {
            console.error('[NotificationPanel] Failed to refresh notifications:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userID: user?.userID,
                timestamp: new Date().toISOString(),
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            ref={panelRef}
            className={cn('notification-panel', className)}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="notification-panel-header">
                <h2>
                    Notifications
                    {unreadCount > 0 && (
                        <span className="unread-count">{unreadCount}</span>
                    )}
                </h2>
                <div className="notification-panel-controls">
                    <button
                        onClick={handleRefresh}
                        className="control-button"
                        disabled={isLoading}
                        aria-label="Refresh notifications"
                    >
                        <FaSync className={cn(isLoading && 'spinning')} />
                    </button>
                </div>
            </div>
            {isLoading && (
                <div className="notification-skeleton">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="skeleton-item pulsing" />
                    ))}
                </div>
            )}
            {!isLoading && filteredNotifications.length === 0 ? (
                <p className="no-notifications">No unread notifications</p>
            ) : (
                <div className="notification-list notification-list-0">
                    {filteredNotifications.map((notification) => (
                        <NotificationItem
                            key={notification.notificationID}
                            notification={notification}
                            onClose={onClose}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default NotificationPanel;