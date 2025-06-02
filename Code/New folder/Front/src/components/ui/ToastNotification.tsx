import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import Notification from '../../models/Notification';
import { useNotification } from '../../context/NotificationContext';
import { cn } from '../../lib/utils';
import './notification.css';

interface ToastNotificationProps {
    notification: Notification;
    onDismiss: (notificationID: string) => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ notification, onDismiss }) => {
    const { markAsRead } = useNotification();
    const [isDismissed, setIsDismissed] = React.useState(false);

    // Auto-dismiss after 5 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsDismissed(true);
            setTimeout(() => onDismiss(notification.notificationID), 300);
        }, 5000);
        return () => clearTimeout(timer);
    }, [notification.notificationID, onDismiss]);

    const handleMarkAsRead = async () => {
        if (notification.status !== 'read' && !isDismissed) {
            setIsDismissed(true);
            try {
                await markAsRead(notification.notificationID);
                setTimeout(() => onDismiss(notification.notificationID), 300);
            } catch (error) {
                console.error('Failed to mark notification as read:', error);
                setIsDismissed(false);
            }
        }
    };

    return (
        <motion.div
            className={cn(
                'toast-notification',
                notification.type,
                notification.status === 'read' && 'read',
                isDismissed && 'dismissed'
            )}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: 0.3 }}
            onClick={handleMarkAsRead}
        >
            <div className="toast-notification-content">
                <p className="message">{notification.message}</p>
                <p className="timestamp">{new Date(notification.createdAt).toLocaleString()}</p>
            </div>
            <button
                className="toast-close-button"
                onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAsRead();
                }}
                aria-label="Close notification"
            >
                <FaTimes />
            </button>
        </motion.div>
    );
};

export default ToastNotification;
