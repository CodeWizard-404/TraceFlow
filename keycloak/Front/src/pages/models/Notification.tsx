// Interface for a notification, matching the backend Notification model
interface Notification {
    notificationID: string;
    userID: string;
    type: 'timesheet' | 'receipt' | 'visit' | 'anomaly' | 'general';
    message: string;
    status: 'pending' | 'sent' | 'read' | 'failed';
    channel: 'websocket' | 'email' | 'sms' | 'in-app';
    createdAt: Date;
    updatedAt: Date;
}

export default Notification;
