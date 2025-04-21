import React, { useEffect, useRef } from 'react';
import { useNotification } from '../../context/NotificationContext';
import NotificationItem from './notification';
import { getNotifications } from '../../apis/notificationAPI';
import { cn } from '../../lib/utils';
import './notification.css';

// Define props for the NotificationPanel
interface NotificationPanelProps {
    className?: string;
    onClose?: () => void;
}

// Component to display a list of notifications
const NotificationPanel: React.FC<NotificationPanelProps> = ({ className, onClose }) => {
    const { notifications, markAllAsRead, addNotification } = useNotification();
    const panelRef = useRef<HTMLDivElement>(null);

    // Fetch notifications on mount
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const fetchedNotifications = await getNotifications();
                fetchedNotifications.forEach((n) => addNotification(n));
            } catch (error) {
                console.error('Failed to fetch notifications:', error);
            }
        };
        fetchNotifications();
    }, [addNotification]);

    // Handle clicks outside the panel
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                if (onClose) onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    return (
        <div
            ref={panelRef}
            className={cn('notification-panel', className)}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="notification-panel-header">
                <h2>Notifications</h2>
                <div className="notification-panel-actions">
                    {notifications.length > 0 && (
                        <button
                            onClick={markAllAsRead}
                            className="mark-all-read"
                        >
                            Mark All as Read
                        </button>
                    )}
                </div>
            </div>
            {notifications.length === 0 ? (
                <p className="no-notifications">No notifications</p>
            ) : (
                <div className="notification-list">
                    {notifications.map((notification) => (
                        <NotificationItem
                            key={notification.notificationID}
                            notification={notification}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default NotificationPanel;