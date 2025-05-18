interface NotificationRule {
    ruleID: string;
    event: string;
    type: string;
    recipients: {
        roles?: string[];
        userIDs?: string[];
    };
    channels: {
        email: boolean;
        sms: boolean;
        inApp: boolean;
    };
    conditions?: Record<string, unknown>;
    messageTemplate: string;
    enabled: boolean;
    creatorID: string;
    createdAt: Date;
    updatedAt: Date;
}

export default NotificationRule;