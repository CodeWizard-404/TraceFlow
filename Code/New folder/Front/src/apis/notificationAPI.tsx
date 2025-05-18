import api from './axiosConfig';
import Notification from '../models/Notification';
import NotificationPreference from '../models/NotificationPreference';
import NotificationRule from '../models/NotificationRule';

// Fetch all notifications for the current user
export const getNotifications = async (): Promise<Notification[]> => {
    try {
        const response = await api.get('/notifications');
        return response.data;
    } catch (error) {
        console.error('Error fetching notifications:', error);
        throw error;
    }
};

// Mark a notification as read
export const markNotificationAsRead = async (notificationID: string): Promise<Notification> => {
    try {
        const response = await api.put(`/notifications/${notificationID}/read`);
        return response.data;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (): Promise<{ message: string }> => {
    try {
        const response = await api.put('/notifications/read-all');
        return response.data;
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
};

// Fetch user notification preferences
export const getNotificationPreferences = async (): Promise<{
    preferences: NotificationPreference['preferences'];
    availableEvents: string[];
}> => {
    try {
        const response = await api.get('/notifications/preferences');
        return response.data;
    } catch (error) {
        console.error('Error fetching notification preferences:', error);
        throw error;
    }
};

// Update user notification preferences
export const updateNotificationPreferences = async (
    preferences: NotificationPreference['preferences']
): Promise<NotificationPreference> => {
    try {
        const response = await api.put('/notifications/preferences', { preferences });
        return response.data;
    } catch (error) {
        console.error('Error updating notification preferences:', error);
        throw error;
    }
};

// Fetch all notification rules (admin only)
export const getNotificationRules = async (): Promise<NotificationRule[]> => {
    try {
        const response = await api.get('/notifications/rules');
        return response.data;
    } catch (error) {
        console.error('Error fetching notification rules:', error);
        throw error;
    }
};

// Create a notification rule (admin only)
export const createNotificationRule = async (rule: NotificationRule): Promise<NotificationRule> => {
    try {
        const response = await api.post('/notifications/rules', rule);
        return response.data;
    } catch (error) {
        console.error('Error creating notification rule:', error);
        throw error;
    }
};

// Update a notification rule (admin only)
export const updateNotificationRule = async (
    ruleID: string,
    rule: Partial<NotificationRule>
): Promise<NotificationRule> => {
    try {
        const response = await api.put(`/notifications/rules/${ruleID}`, rule);
        return response.data;
    } catch (error) {
        console.error('Error updating notification rule:', error);
        throw error;
    }
};

// Delete a notification rule (admin only)
export const deleteNotificationRule = async (ruleID: string): Promise<void> => {
    try {
        await api.delete(`/notifications/rules/${ruleID}`);
    } catch (error) {
        console.error('Error deleting notification rule:', error);
        throw error;
    }
};

// Fetch available notification types
export const getNotificationTypes = async (): Promise<string[]> => {
    try {
        const response = await api.get('/notifications/types');
        return response.data.types;
    } catch (error) {
        console.error('Error fetching notification types:', error);
        throw error;
    }
};

// Create a new notification
export const createNotification = async (
    notification: {
        event: string;
        data?: Record<string, unknown>;
        roles?: string[];
        userIDs?: string[];
        type: string;
        message: string;
        email?: string;
        sms?: string;
    }
): Promise<{ results: Notification[]; message: string }> => {
    try {
        const response = await api.post('/notifications', notification);
        return response.data;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};