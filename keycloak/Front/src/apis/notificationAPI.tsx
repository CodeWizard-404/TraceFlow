import api from './axiosConfig';
import Notification from '../pages/models/Notification';
import NotificationPreference from '../pages/models/NotificationPreference';
import NotificationRule from '../pages/models/NotificationRule';

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

// Fetch user notification preferences
export const getNotificationPreferences = async (): Promise<NotificationPreference> => {
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
    preferences: Partial<NotificationPreference>
): Promise<NotificationPreference> => {
    try {
        const response = await api.put('/notifications/preferences', preferences);
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
