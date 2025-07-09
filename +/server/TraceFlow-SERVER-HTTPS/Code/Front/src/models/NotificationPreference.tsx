interface NotificationPreference {
    preferenceID: string;
    userID: string;
    preferences: {
        [event: string]: {
            email: boolean;
            sms: boolean;
            inApp: boolean;
        };
    };
    createdAt: Date;
    updatedAt: Date;
}

export default NotificationPreference;