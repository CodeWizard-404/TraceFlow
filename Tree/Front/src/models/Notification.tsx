// Interface for a notification, matching the backend Notification model
interface Notification {
    notificationID: string;
    userID: string;
    type: string; // e.g., 'general', 'timesheet', or any admin-defined type
    message: string;
    status: 'pending' | 'sent' | 'read' | 'failed';
    channel: 'websocket' | 'email' | 'sms' | 'inApp';
    createdAt: Date;
    updatedAt: Date;
}

export default Notification;
