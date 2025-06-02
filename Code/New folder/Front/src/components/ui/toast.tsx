import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotification } from '../../context/NotificationContext';
import Notification from '../../models/Notification';
import { cn } from '../../lib/utils';
import { markNotificationAsRead } from '../../apis/notificationAPI';
import './toast.css';

// Define props for the Toast component
interface ToastProps {
    notification: Notification;
    onClose: () => void;
}

// Component to display a single toast notification
const Toast: React.FC<ToastProps> = ({ notification, onClose }) => {
    const { markAsRead } = useNotification();

    // Auto-dismiss after 5 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    // Handle marking the notification as read
    const handleMarkAsRead = async () => {
        try {
            await markNotificationAsRead(notification.notificationID);
            markAsRead(notification.notificationID);
            onClose();
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
            className={cn(
                'toast',
                notification.type,
                notification.status === 'read' && 'read',
                'fixed bottom-4 right-4 max-w-xs bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700'
            )}
        >
            <div className="flex justify-between items-start">
                <div className="toast-content">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{notification.message}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(notification.createdAt).toLocaleString()}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                    ✕
                </button>
            </div>
            {notification.status !== 'read' && (
                <button
                    onClick={handleMarkAsRead}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                    Mark as Read
                </button>
            )}
        </motion.div>
    );
};

// Wrapper component to manage multiple toasts
export const ToastContainer: React.FC = () => {
    const { notifications } = useNotification();
    const [visibleToasts, setVisibleToasts] = React.useState<Notification[]>([]);

    // Update visible toasts when new notifications arrive
    useEffect(() => {
        const criticalTypes = ['otp', 'general', 'anomaly']; // Show toasts for these types
        const newToasts = notifications.filter(
            (n) => n.status !== 'read' && criticalTypes.includes(n.type) && !visibleToasts.find((v) => v.notificationID === n.notificationID)
        );
        setVisibleToasts((prev) => [...newToasts, ...prev].slice(0, 3)); // Limit to 3 toasts
    }, [notifications, visibleToasts]);

    // Remove a toast by ID
    const removeToast = (notificationID: string) => {
        setVisibleToasts((prev) => prev.filter((n) => n.notificationID !== notificationID));
    };

    return (
        <AnimatePresence>
            {visibleToasts.map((notification) => (
                <Toast
                    key={notification.notificationID}
                    notification={notification}
                    onClose={() => removeToast(notification.notificationID)}
                />
            ))}
        </AnimatePresence>
    );
};

export default ToastContainer;