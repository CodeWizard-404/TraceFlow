import React from 'react';
import Notification from '../../models/Notification';
import { useNotification } from '../../context/NotificationContext';
import { cn } from '../../lib/utils';
import './notification.css';

// Define props for the NotificationItem component
interface NotificationItemProps {
    notification: Notification;
    onClose?: () => void;
}

// Component to display a single notification
const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClose }) => {
    const { markAsRead } = useNotification();

    // Handle marking the notification as read
    const handleMarkAsRead = () => {
        markAsRead(notification.notificationID);
        if (onClose) onClose();
    };

    return (
        <div
            className={cn(
                'notification-item',
                notification.type,
                notification.status === 'read' && 'read'
            )}
        >
            <div className="notification-content">
                <p className="message">{notification.message}</p>
                <p className="timestamp">
                    {new Date(notification.createdAt).toLocaleString()}
                </p>
            </div>
            {notification.status !== 'read' && (
                <button
                    onClick={handleMarkAsRead}
                    className="notification-action"
                >
                    Mark as Read
                </button>
            )}
        </div>
    );
};

export default NotificationItem;