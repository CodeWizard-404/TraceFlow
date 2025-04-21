import React from 'react';
import Notification from '../../pages/models/Notification';
import { useNotification } from '../../context/NotificationContext';
import { cn } from '../../lib/utils';

// Define props for the NotificationItem component
interface NotificationItemProps {
    notification: Notification;
    onClose?: () => void;
}

// Map notification types to Tailwind CSS classes
const typeStyles: Record<Notification['type'], string> = {
    timesheet: 'bg-blue-500 text-white',
    receipt: 'bg-green-500 text-white',
    visit: 'bg-purple-500 text-white',
    anomaly: 'bg-red-500 text-white',
    general: 'bg-gray-500 text-white',
};

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
                'p-4 rounded-lg shadow-md flex justify-between items-center max-w-md',
                typeStyles[notification.type],
                notification.status === 'read' ? 'opacity-75' : ''
            )}
        >
            <div>
                <p className="font-semibold">{notification.message}</p>
                <p className="text-sm opacity-80">
                    {new Date(notification.createdAt).toLocaleString()}
                </p>
            </div>
            {notification.status !== 'read' && (
                <button
                    onClick={handleMarkAsRead}
                    className="text-sm underline hover:text-gray-200"
                >
                    Mark as Read
                </button>
            )}
        </div>
    );
};

export default NotificationItem;
