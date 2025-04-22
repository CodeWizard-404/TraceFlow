import React, { useState } from 'react';
import Notification from '../../models/Notification';
import { useNotification } from '../../context/NotificationContext';
import { cn } from '../../lib/utils';
import './notification.css';

interface NotificationItemProps {
    notification: Notification;
    onClose?: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClose }) => {
    const { markAsRead } = useNotification();
    const [isDismissed, setIsDismissed] = useState(false);

    const handleMarkAsRead = () => {
        if (notification.status !== 'read') {
            setIsDismissed(true);
            setTimeout(() => {
                markAsRead(notification.notificationID);
                if (onClose) onClose();
            }, 300); // Match slideOut animation duration
        }
    };

    return (
        <div
            className={cn(
                'notification-item',
                notification.type,
                notification.status === 'read' && 'read',
                isDismissed && 'dismissed'
            )}
            onClick={handleMarkAsRead}
        >
            <div className="notification-content">
                <p className="message">{notification.message}</p>
                <p className="timestamp">
                    {new Date(notification.createdAt).toLocaleString()}
                </p>
            </div>
        </div>
    );
};

export default NotificationItem;