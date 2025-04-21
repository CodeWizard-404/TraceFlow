// Interface for a notification rule, matching the backend NotificationRule model
interface NotificationRule {
    ruleID: string;
    event: string; // e.g., 'user:created', 'timesheet:reminder'
    type: string; // e.g., 'timesheet', 'receipt', 'general'
    recipients: {
        roles?: string[]; // e.g., ['manager', 'supervisor']
        userIDs?: string[]; // CEREBRO: e.g., ['user_123']
    };
    channels: {
        websocket: boolean;
        email: boolean;
        sms: boolean;
        inApp: boolean;
    };
    conditions?: Record<string, unknown>; // e.g., { status: 'validated' }
    messageTemplate: string; // e.g., 'New user {email} created'
    enabled: boolean;
    creatorID: string; // ID of the user who created the rule
    createdAt: Date;
    updatedAt: Date;
}

export default NotificationRule;