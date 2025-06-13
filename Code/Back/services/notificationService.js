const io = require('../utils/socket');
const { sendSMS } = require('../config/sms');
const { sendEmail } = require('../config/smtp');
const { Notification, NotificationPreference, NotificationRule, User, Role } = require('../models');
const { Op } = require('sequelize');
const { getRedisClient, getRedisSubClient } = require('../config/redis');
const RedisUtils = require('../utils/redisUtils');

const ERROR_MESSAGES = {
    INVALID_RULE: 'Invalid notification rule.',
    INVALID_CHANNELS: 'Channels must only include email, sms, and inApp.',
    INVALID_PRIORITY: 'Priority must be "high" or "normal".',
    INVALID_PREFERENCES: 'Invalid notification preferences.',
};

class NotificationService {
    constructor() {
        this.redis = getRedisClient();
        this.redisSub = getRedisSubClient();

        this.redisSub.subscribe('notifications', (err) => {
            if (err) {
                console.error('Failed to subscribe to notifications:', err.message);
            } else {
                console.log('Subscribed to notifications channel');
            }
        });

        this.redisSub.on('message', (channel, message) => {
            if (channel === 'notifications') {
                try {
                    const { room, data } = JSON.parse(message);
                    io.to(room).emit('notification', data);
                } catch (error) {
                    console.error('Failed to process notification message:', error.message);
                }
            }
        });
    }

    async createRule(data, creatorID, logInfo) {
        const { event, type, recipients, channels, conditions, messageTemplate, enabled, priority } = data;

        if (channels.websocket !== undefined || !['email', 'sms', 'inApp'].every(c => typeof channels[c] === 'boolean')) {
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_CHANNELS), { status: 400 });
        }

        if (priority && !['high', 'normal'].includes(priority)) {
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_PRIORITY), { status: 400 });
        }

        const rule = await NotificationRule.create({
            event,
            type,
            recipients,
            channels,
            conditions,
            messageTemplate,
            enabled: enabled !== undefined ? enabled : true,
            priority: priority || 'normal',
            creatorID,
        });

        if (rule.priority === 'high') {
            await this.handlePriorityChange(rule);
        }
        return rule;
    }

    async updateRule(ruleID, data, logInfo) {
        const { event, type, recipients, channels, conditions, messageTemplate, enabled, priority } = data;

        if (channels.websocket !== undefined || !['email', 'sms', 'inApp'].every(c => typeof channels[c] === 'boolean')) {
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_CHANNELS), { status: 400 });
        }

        if (priority && !['high', 'normal'].includes(priority)) {
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_PRIORITY), { status: 400 });
        }

        const rule = await NotificationRule.findByPk(ruleID);
        if (!rule) {
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_RULE), { status: 404 });
        }

        const wasNormalPriority = rule.priority === 'normal';
        await rule.update({
            event,
            type,
            recipients,
            channels,
            conditions,
            messageTemplate,
            enabled,
            priority: priority || rule.priority,
        });

        if (wasNormalPriority && rule.priority === 'high') {
            await this.handlePriorityChange(rule);
        }

        return rule;
    }

    async deleteRule(ruleID, logInfo) {
        const rule = await NotificationRule.findByPk(ruleID);
        if (!rule) {
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_RULE), { status: 404 });
        }
        await rule.destroy();
        return { message: 'Notification rule deleted successfully.' };
    }

    async getRules(logInfo) {
        const rules = await NotificationRule.findAll();
        return rules;
    }

    async getNotificationTypes(logInfo) {
        const rules = await NotificationRule.findAll({
            attributes: ['type'],
            group: ['type'],
        });
        const types = rules.map(rule => rule.type);
        return types;
    }


    async getPreferences(userID, logInfo) {
        const preference = await NotificationPreference.findOne({ where: { userID } });
        const rules = await NotificationRule.findAll({
            attributes: ['event', 'priority'],
            group: ['event', 'priority'],
        });
        const availableEvents = rules.map(rule => ({
            event: rule.event,
            isCustomizable: rule.priority !== 'high',
        }));

        const storedPrefs = preference?.preferences || {};
        const preferences = {};
        for (const { event } of availableEvents) {
            preferences[event] = storedPrefs[event] || {
                email: rules.channels?.email || false,
                sms: rules.channels?.sms || false,
                inApp: rules.channels?.inApp || true,
            };
        }

        const sanitizedPreferences = {};
        for (const [event, channels] of Object.entries(preferences)) {
            sanitizedPreferences[event] = {
                email: channels.email,
                sms: channels.sms,
                inApp: channels.inApp,
            };
        }

        return { preferences: sanitizedPreferences, availableEvents };
    }

    async getNotifications(userID, logInfo) {
        const notifications = await Notification.findAll({
            where: { userID },
            order: [['createdAt', 'DESC']],
        });
        return notifications;
    }

    async markNotificationAsRead(notificationID, userID, logInfo) {
        const notification = await Notification.findByPk(notificationID);
        if (!notification || notification.userID !== userID) {
            throw Object.assign(new Error('Notification not found or unauthorized'), { status: 404 });
        }
        await notification.update({ status: 'read' });
        return notification;
    }

    async markAllNotificationsAsRead(userID, logInfo) {
        const updatedCount = await Notification.update(
            { status: 'read' },
            {
                where: {
                    userID,
                    status: { [Op.in]: ['pending', 'sent'] },
                },
            }
        );
        return { message: `Marked ${updatedCount[0]} notifications as read.` };
    }

    async createNotification(data, logInfo) {
        const { event, data: notificationData, roles, userIDs, type, message, email, sms } = data;
        const results = await this.sendNotification({
            event,
            data: notificationData,
            roles: roles || [],
            userIDs: userIDs || [],
            type,
            message,
            email,
            sms,
        });
        return { results, message: 'Notification sent successfully.' };
    }

    async notifyAnomaly(data, userEmail, logInfo) {
        const { dataType, anomalies, userIDs, roles } = data;
        const results = await this.triggerNotification({
            event: 'ai:anomaly_detected',
            data: { dataType, anomalyCount: anomalies.length },
            metadata: { triggeredBy: userEmail, anomalies },
            roles: roles || [],
            userIDs: userIDs || [],
        });
        return { results, message: 'Anomaly notification sent successfully.' };
    }

    async notifyReport(data, userEmail, logInfo) {
        const { format, filters, userIDs, roles } = data;
        const results = await this.triggerNotification({
            event: 'ai:report_generated',
            data: { format, filters },
            metadata: { triggeredBy: userEmail },
            roles: roles || [],
            userIDs: userIDs || [],
        });
        return { results, message: 'Report notification sent successfully.' };
    }

    async sendWebSocketNotification(event, data, roles = [], userIDs = []) {
        try {
            if (!io || !io.sockets) {
                return { success: false, method: 'WebSocket', reason: 'Server not initialized' };
            }
            const payload = { event, data, timestamp: new Date().toISOString() };
            const rooms = [...roles.map(r => r.toLowerCase()), ...userIDs, 'default-roles-traceflow'].filter(Boolean);
            if (rooms.length === 0) {
                return { success: true, method: 'WebSocket', reason: 'No rooms to notify' };
            }
            rooms.forEach((room) => {
                io.to(room).emit(event, payload);
            });
            return { success: true, method: 'WebSocket' };
        } catch (error) {
            return { success: false, method: 'WebSocket', reason: error.message };
        }
    }

    async sendEmailNotification(to, subject, message, data = {}, metadata = {}) {
        try {
            const resolvedMessage = await Promise.resolve(message);
            let detailedMessage = `Event: ${resolvedMessage}\n`;
            if (data && Object.keys(data).length) {
                detailedMessage += `Details:\n${Object.entries(data)
                    .map(([key, value]) => `- ${key}: ${value}`)
                    .join('\n')}\n`;
            }
            if (metadata.triggeredBy) {
                detailedMessage += `Triggered by: ${metadata.triggeredBy}\n`;
            }
            detailedMessage += `Timestamp: ${new Date().toLocaleString()}\n`;

            await sendEmail({
                to,
                subject,
                templateName: 'default',
                replacements: {
                    firstname: 'User',
                    content: detailedMessage.replace(/\n/g, '<br>'),
                    event: resolvedMessage,
                    timestamp: new Date().toLocaleString(),
                    platformUrl: process.env.PLATFORM_URL || 'https://traceflow.example.com',
                },
                textFallback: detailedMessage,
            });
            return { success: true, method: 'Email' };
        } catch (error) {
            return { success: false, method: 'Email', reason: error.message };
        }
    }

    async sendSMSNotification(to, message, data = {}, metadata = {}) {
        try {
            const resolvedMessage = await Promise.resolve(message);
            let smsMessage = `${resolvedMessage}`;
            if (data && Object.keys(data).length) {
                const keyDetail = Object.entries(data)[0];
                smsMessage += ` (${keyDetail[0]}: ${keyDetail[1]})`;
            }
            smsMessage += `. Check traceflow.app`;
            const result = await sendSMS(to, smsMessage, 'notification');
            return result;
        } catch (error) {
            return { success: false, method: 'SMS', reason: error.message };
        }
    }

    async storeNotification({ userID, type, message, channel, event, rule }) {
        try {
            if (!rule || !rule.enabled) {
                return null;
            }

            const { preferences } = await this.getUserPreferences(userID, event, rule);
            if (channel === 'in-app' && !preferences.inApp) return null;
            if (channel === 'email' && !preferences.email) return null;
            if (channel === 'sms' && !preferences.sms) return null;

            const notificationMessage = await Promise.resolve(message).then(String);
            if (!notificationMessage) {
                return null;
            }

            const notification = await Notification.create({
                userID,
                type,
                message: notificationMessage,
                channel,
                status: 'pending',
            });

            if (channel === 'in-app' && preferences.inApp) {
                await this.updateNotificationStatus(notification.notificationID, 'sent');
                await this.sendWebSocketNotification('notification:created', { data: notification }, [], [userID]);
            }

            return notification;
        } catch (error) {
            return null;
        }
    }

    async updateNotificationStatus(notificationID, status) {
        const notification = await Notification.findByPk(notificationID);
        if (notification) {
            notification.status = status;
            await notification.save();
            const event = 'notification:updated';
            const data = {
                notificationID,
                status,
                updatedAt: new Date(),
            };
            await this.sendWebSocketNotification(event, data, [], [notification.userID]);
        }

    }

    async createDefaultDisabledRule({ event, data, metadata = {} }) {
        try {
            if (!event || !data) return null;
            const existingRule = await NotificationRule.findOne({ where: { event } });
            if (existingRule) return existingRule;
            const notificationType = event.split(':')[0];
            const defaultRule = {
                event,
                type: notificationType,
                recipients: {
                    roles: [process.env.ROLE_ADMIN, process.env.ROLE_SUPER_ADMIN],
                    userIDs: [],
                },
                channels: {
                    email: event.includes('ai:') ? true : false,
                    sms: event.includes('ai:anomaly_detected') ? true : false,
                    inApp: true,
                },
                conditions: data.conditions || null,
                messageTemplate: event === 'ai:anomaly_detected'
                    ? 'AI detected {anomalyCount} anomalies in {dataType} data.'
                    : event === 'ai:report_generated'
                        ? 'AI generated a {format} report with filters: {filters}.'
                        : '{event}',
                enabled: true,
                priority: 'normal',
            };
            const rule = await NotificationRule.create(defaultRule);
            return rule;
        } catch (error) {
            return null;
        }
    }

    async handlePriorityChange(rule) {
        if (rule.priority !== 'high') return;

        const preferences = await NotificationPreference.findAll({
            where: {
                preferences: {
                    [Op.contains]: { [rule.event]: {} }
                }
            }
        });

        for (const pref of preferences) {
            const userPrefs = pref.preferences || {};
            if (userPrefs[rule.event]) {
                delete userPrefs[rule.event];
                await NotificationPreference.update(
                    { preferences: userPrefs },
                    { where: { userID: pref.userID } }
                );
                await RedisUtils.invalidateUserPreferences(pref.userID);
            }
        }

    }

    async triggerNotification({ event, data, metadata = {} }) {
        try {
            const allUsers = await User.findAll();
            const allRoles = await Role.findAll();
            const userIDs = allUsers.map(user => user.userID);
            const roleNames = allRoles.map(role => role.name);

            const triggerEventPayload = { event, data, timestamp: new Date().toISOString() };
            await this.sendWebSocketNotification(event, triggerEventPayload, roleNames, userIDs);

            const allRules = await NotificationRule.findAll({ where: { event } });
            for (const rule of allRules) {
                await this.handlePriorityChange(rule);
            }

            const rules = await NotificationRule.findAll({ where: { event, enabled: true } });
            if (!rules.length) {
                const defaultRule = await this.createDefaultDisabledRule({ event, data, metadata });
                if (defaultRule && defaultRule.enabled) {
                    await this.handlePriorityChange(defaultRule);
                    rules.push(defaultRule);
                } else {
                    return [{ success: true, method: 'WebSocket', reason: 'No enabled rules, WebSocket sent' }];
                }
            }

            const results = [];
            for (const rule of rules) {
                const recipients = await this.resolveRecipients(rule.recipients);
                for (const user of recipients) {
                    const messageData = { event, ...data, ...metadata };
                    const message = await this.formatMessage(rule.messageTemplate, messageData);
                    if (!message) {
                        throw new Error(`Invalid notification message for event: ${event}`);
                    }
                    const result = await this.sendNotification({
                        event: rule.event,
                        data,
                        roles: rule.recipients.roles || [],
                        userIDs: [user.userID],
                        type: rule.type,
                        message,
                        email: user.email,
                        sms: user.phone,
                        metadata,
                        rule,
                    });
                    results.push({ userID: user.userID, ruleID: rule.ruleID, result });
                }
            }

            return results;
        } catch (error) {
            return [{ success: false, reason: error.message }];
        }
    }

    async resolveRecipients(recipients) {
        try {
            const users = new Set();
            if (recipients.roles?.length) {
                const roleUsers = await User.findAll({
                    include: [{
                        model: Role,
                        where: { name: { [Op.in]: recipients.roles } },
                        through: { attributes: [] },
                    }],
                });
                roleUsers.forEach(user => users.add(user));
            }
            if (recipients.userIDs?.length) {
                const specificUsers = await User.findAll({
                    where: { userID: { [Op.in]: recipients.userIDs } },
                });
                specificUsers.forEach(user => users.add(user));
            }
            return Array.from(users);
        } catch (error) {
            return [];
        }
    }

    async formatMessage(template, data) {
        const resolvedData = {};
        for (const [key, value] of Object.entries(data)) {
            resolvedData[key] = await Promise.resolve(value);
        }
        return template.replace(/{(\w+)}/g, (_, key) => resolvedData[key] || '');
    }
}

module.exports = new NotificationService();