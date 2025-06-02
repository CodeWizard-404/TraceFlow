interface Notification {
    notificationID: string;
    userID: string;
    type: string;
    message: string;
    status: 'pending' | 'sent' | 'read' | 'failed';
    channel: 'email' | 'sms' | 'in-app';
    createdAt: Date;
    updatedAt: Date;
}

export default Notification;