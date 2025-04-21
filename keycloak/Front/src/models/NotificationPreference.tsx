// Interface for notification preferences, matching the backend NotificationPreference model
interface NotificationPreference {
    preferenceID: string;
    userID: string;
    emailEnabled: boolean;
    smsEnabled: boolean;
    inAppEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export default NotificationPreference;
