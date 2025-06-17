interface Notification {
    notificationID: string;
    userID: string;
    type: string;
    message: string;
    status: 'pending' | 'sent' | 'read' | 'failed';
    channel: 'email' | 'sms' | 'in-app';
    createdAt: Date;
    updatedAt: Date;
    details?: Record<string, any>;
    severity?: string; // Add severity field
}

export default Notification;