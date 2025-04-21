import React, { useEffect } from 'react';
import { useNotification } from '../../context/NotificationContext';
import NotificationItem from './notification';
import { getNotifications } from '../../apis/notificationAPI';
import { cn } from '../../lib/utils';

// Define props for the NotificationPanel
interface NotificationPanelProps {
    className?: string;
    onClose?: () => void;
}

// Component to display a list of notifications
const NotificationPanel: React.FC<NotificationPanelProps> = ({ className, onClose }) => {
    const { notifications, markAllAsRead, addNotification } = useNotification();

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

    return (
        <div
            className={cn(
                'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-md w-full',
                className
            )}
        >
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Notifications</h2>
                <div>
                    {notifications.length > 0 && (
                        <button
                            onClick={markAllAsRead}
                            className="text-sm text-blue-500 hover:underline mr-2"
                        >
                            Mark All as Read
                        </button>
                    )}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="text-sm text-gray-500 hover:underline"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
            {notifications.length === 0 ? (
                <p className="text-gray-500">No notifications</p>
            ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
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
