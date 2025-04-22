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
    const [isLoading, setIsLoading] = useState(false);

    const handleMarkAsRead = async () => {
        if (notification.status !== 'read' && !isLoading) {
            setIsLoading(true);
            setIsDismissed(true);
            try {
                await markAsRead(notification.notificationID);
                setTimeout(() => {
                    if (onClose) onClose();
                    setIsLoading(false);
                }, 300); // Match slideOut animation duration
            } catch {
                setIsDismissed(false); // Revert UI if API fails
                setIsLoading(false);
            }
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
            style={{ pointerEvents: isLoading ? 'none' : 'auto' }}
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