import React, { useState } from 'react';
import Notification from '../../models/Notification';
import { useNotification } from '../../context/NotificationContext';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import './notification.css';

interface NotificationItemProps {
    notification: Notification;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification }) => {
    const { markAsRead } = useNotification();
    const { t } = useTranslation();
    const [isDismissed, setIsDismissed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleMarkAsRead = async () => {
        if (notification.status !== 'read' && !isLoading) {
            setIsLoading(true);
            setIsDismissed(true);
            try {
                await markAsRead(notification.notificationID);
                // Delay to allow dismissal animation to complete
                setTimeout(() => {
                    setIsLoading(false);
                }, 300);
            } catch (error) {
                console.error('Failed to mark notification as read:', error);
                setIsDismissed(false);
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
            aria-label={t('notification.markAsRead')}
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