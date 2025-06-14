const io = require('../utils/socket'); // Socket.io for real-time WebSocket notifications
const { sendSMS } = require('../config/sms'); // SMS sending utility
const { sendEmail } = require('../config/smtp'); // Email sending utility
const { Notification, NotificationPreference, NotificationRule, User, Role } = require('../models'); // Sequelize models
const { Op } = require('sequelize'); // Sequelize operators for queries
const { getRedisClient, getRedisSubClient } = require('../config/redis'); // Redis client utilities
const RedisUtils = require('../utils/redisUtils'); // Redis helper utilities

// Error messages for common issues
const ERROR_MESSAGES = {
    INVALID_RULE: 'Invalid notification rule.',
    INVALID_CHANNELS: 'Channels must only include email, sms, and inApp.',
    INVALID_PRIORITY: 'Priority must be "high" or "normal".',
    INVALID_PREFERENCES: 'Invalid notification preferences.',
};

class NotificationService {
    constructor() {
        // Initialize Redis clients for caching and pub/sub
        this.redis = getRedisClient();
        this.redisSub = getRedisSubClient();

        // Subscribe to Redis 'notifications' channel for real-time messages
        this.redisSub.subscribe('notifications', (err) => {
            if (err) {
                console.error('Failed to subscribe to notifications:', err.message);
            } else {
                console.log('Subscribed to notifications channel');
            }
        });

        // Handle incoming Redis messages
        this.redisSub.on('message', (channel, message) => {
            if (channel === 'notifications') {
                try {
                    const { room, data } = JSON.parse(message);
                    // Emit notification to specific Socket.io room
                    io.to(room).emit('notification', data);
                } catch (error) {
                    console.error('Failed to process notification message:', error.message);
                }
            }
        });
    }

    // Create a new notification rule (unchanged as per request)
    async createRule(data, creatorID, logInfo) {
        const { event, type, recipients, channels, conditions, messageTemplate, enabled, priority } = data;

        // Validate channels (only email, sms, inApp allowed)
        if (channels.websocket !== undefined || !['email', 'sms', 'inApp'].every(c => typeof channels[c] === 'boolean')) {
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_CHANNELS), { status: 400 });
        }

        // Validate priority (only high or normal allowed)
        if (priority && !['high', 'normal'].includes(priority)) {
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_PRIORITY), { status: 400 });
        }

        // Create rule in database
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

        // Handle high-priority rules (clear user preferences if needed)
        if (rule.priority === 'high') {
            await this.handlePriorityChange(rule);
        }
        return rule;
    }

    // Update an existing rule (unchanged as per request)
    async updateRule(ruleID, data, logInfo) {
        const { event, type, recipients, channels, conditions, messageTemplate, enabled, priority } = data;

        // Validate channels
        if (channels.websocket !== undefined || !['email', 'sms', 'inApp'].every(c => typeof channels[c] === 'boolean')) {
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_CHANNELS), { status: 400 });
        }

        // Validate priority
        if (priority && !['high', 'normal'].includes(priority)) {
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_PRIORITY), { status: 400 });
        }

        // Find and update rule
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

        // Handle priority change to high
        if (wasNormalPriority && rule.priority === 'high') {
            await this.handlePriorityChange(rule);
        }

        return rule;
    }

    // Delete a rule
    async deleteRule(ruleID, logInfo) {
        const rule = await NotificationRule.findByPk(ruleID);
        if (!rule) {
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_RULE), { status: 404 });
        }
        await rule.destroy();
        return { message: 'Notification rule deleted successfully.' };
    }

    // Get all rules
    async getRules(logInfo) {
        const rules = await NotificationRule.findAll();
        return rules;
    }

    // Get unique notification types
    async getNotificationTypes(logInfo) {
        const rules = await NotificationRule.findAll({
            attributes: ['type'],
            group: ['type'],
        });
        const types = rules.map(rule => rule.type);
        return types;
    }

    // Get user notification preferences and available events
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

    // Get all notifications for a user
    async getNotifications(userID, logInfo) {
        const notifications = await Notification.findAll({
            where: { userID },
            order: [['createdAt', 'DESC']],
        });
        return notifications;
    }

    // Mark a single notification as read
    async markNotificationAsRead(notificationID, userID, logInfo) {
        const notification = await Notification.findByPk(notificationID);
        if (!notification || notification.userID !== userID) {
            throw Object.assign(new Error('Notification not found or unauthorized'), { status: 404 });
        }
        await notification.update({ status: 'read' });
        return notification;
    }

    // Mark all notifications for a user as read
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

    // Create and trigger a notification
    async createNotification(data, logInfo) {
        const { event, data: notificationData, roles, userIDs, type, message, email, sms, dynamicRecipients, triggeredByUserID } = data;
        const results = await this.sendNotification({
            event,
            data: notificationData,
            roles: roles || [],
            userIDs: userIDs || [],
            dynamicRecipients,
            triggeredByUserID, // Pass user who triggered the notification
            type,
            message,
            email,
            sms,
        });
        return { results, message: 'Notification sent successfully.' };
    }

    // Notify for anomaly detection
    async notifyAnomaly(data, userEmail, logInfo) {
        const { dataType, anomalies, userIDs, roles, dynamicRecipients, triggeredByUserID } = data;
        const results = await this.triggerNotification({
            event: 'ai:anomaly_detected',
            data: { dataType, anomalyCount: anomalies.length },
            metadata: { triggeredBy: userEmail, anomalies },
            roles: roles || [],
            userIDs: userIDs || [],
            dynamicRecipients,
            triggeredByUserID, // Pass user who triggered the notification
        });
        return { results, message: 'Anomaly notification sent successfully.' };
    }

    // Notify for report generation
    async notifyReport(data, userEmail, logInfo) {
        const { format, filters, userIDs, roles, dynamicRecipients, triggeredByUserID } = data;
        const results = await this.triggerNotification({
            event: 'ai:report_generated',
            data: { format, filters },
            metadata: { triggeredBy: userEmail },
            roles: roles || [],
            userIDs: userIDs || [],
            dynamicRecipients,
            triggeredByUserID, // Pass user who triggered the notification
        });
        return { results, message: 'Report notification sent successfully.' };
    }

    // Send WebSocket notification to specific rooms
    async sendWebSocketNotification(event, data, roles = [], userIDs = []) {
        try {
            if (!io || !io.sockets) {
                return { success: false, method: 'WebSocket', reason: 'Server not initialized' };
            }
            const payload = { event, data, timestamp: new Date().toISOString() };
            // Deduplicate rooms to prevent multiple emissions
            const rooms = [...new Set([...roles.map(r => r.toLowerCase()), ...userIDs, 'default-roles-traceflow'].filter(Boolean))];
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

    // Send email notification
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

    // Send SMS notification
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

    // Store notification in database with deduplication
    async storeNotification({ userID, type, message, channel, event, rule }) {
        try {
            if (!rule || !rule.enabled) {
                return null;
            }

            // Check user preferences
            const { preferences } = await this.getUserPreferences(userID, event, rule);
            if (channel === 'in-app' && !preferences.inApp) return null;
            if (channel === 'email' && !preferences.email) return null;
            if (channel === 'sms' && !preferences.sms) return null;

            const notificationMessage = await Promise.resolve(message).then(String);
            if (!notificationMessage) {
                return null;
            }

            // Create a unique key for deduplication
            const dedupKey = `notif:${userID}:${event}:${channel}:${notificationMessage}`;
            const exists = await this.redis.get(dedupKey);
            if (exists) {
                console.log(`Duplicate notification skipped for user ${userID}, event ${event}, channel ${channel}`);
                return null; // Skip if notification already exists
            }

            // Store notification and set deduplication key (expires in 60 seconds)
            const notification = await Notification.create({
                userID,
                type,
                message: notificationMessage,
                channel,
                status: 'pending',
            });

            await this.redis.set(dedupKey, '1', 'EX', 60);

            // Send in-app notification via WebSocket
            if (channel === 'in-app' && preferences.inApp) {
                await this.updateNotificationStatus(notification.notificationID, 'sent');
                await this.sendWebSocketNotification('notification:created', { data: notification }, [], [userID]);
            }

            return notification;
        } catch (error) {
            console.error(`Failed to store notification for user ${userID}:`, error.message);
            return null;
        }
    }

    // Update notification status and notify via WebSocket
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

    // Create a default disabled rule for an event
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
            console.error('Failed to create default rule:', error.message);
            return null;
        }
    }

    // Handle priority changes for high-priority rules
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

    // Trigger a notification for an event
    async triggerNotification({ event, data, metadata = {}, roles = [], userIDs = [], dynamicRecipients, triggeredByUserID }) {
        try {
            const allUsers = await User.findAll();
            const allRoles = await Role.findAll();
            const userIDsAll = allUsers.map(user => user.userID);
            const roleNames = allRoles.map(role => role.name);

            // Send WebSocket notification to all relevant rooms
            const triggerEventPayload = { event, data, timestamp: new Date().toISOString() };
            await this.sendWebSocketNotification(event, triggerEventPayload, roleNames, userIDsAll);

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
                // Use dynamicRecipients if provided, otherwise resolve from rule
                let recipients = dynamicRecipients
                    ? await this.resolveDynamicRecipients(dynamicRecipients)
                    : await this.resolveRecipients(rule.recipients);

                // Filter out the user who triggered the notification
                if (triggeredByUserID) {
                    recipients = recipients.filter(user => user.userID !== triggeredByUserID);
                }

                // Skip if no recipients remain
                if (!recipients.length) {
                    results.push({ success: false, ruleID: rule.ruleID, reason: 'No valid recipients after filtering' });
                    continue;
                }

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
                        dynamicRecipients: dynamicRecipients ? [user.userID] : undefined,
                        triggeredByUserID, // Pass triggering user ID
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
            console.error('Failed to trigger notification:', error.message);
            return [{ success: false, reason: error.message }];
        }
    }

    // Resolve recipients from roles and user IDs
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
            console.error('Failed to resolve recipients:', error.message);
            return [];
        }
    }

    // Resolve dynamic recipients
    async resolveDynamicRecipients(userIDs) {
        try {
            if (!userIDs || !userIDs.length) return [];
            const users = await User.findAll({
                where: { userID: { [Op.in]: userIDs } },
            });
            return users;
        } catch (error) {
            console.error('Failed to resolve dynamic recipients:', error.message);
            return [];
        }
    }

    // Format message template with data
    async formatMessage(template, data) {
        const resolvedData = {};
        for (const [key, value] of Object.entries(data)) {
            resolvedData[key] = await Promise.resolve(value);
        }
        return template.replace(/{(\w+)}/g, (_, key) => resolvedData[key] || '');
    }

    // Send notification to recipients
    async sendNotification({ event, data, roles, userIDs, dynamicRecipients, triggeredByUserID, type, message, email, sms, metadata = {}, rule }) {
        try {
            const results = [];
            // Use dynamicRecipients if provided, otherwise resolve from roles/userIDs
            let recipients = dynamicRecipients
                ? await this.resolveDynamicRecipients(dynamicRecipients)
                : await this.resolveRecipients({ roles, userIDs });

            // Filter out the user who triggered the notification
            if (triggeredByUserID) {
                recipients = recipients.filter(user => user.userID !== triggeredByUserID);
            }

            // Skip if no recipients remain
            if (!recipients.length) {
                results.push({ success: false, reason: 'No valid recipients after filtering' });
                return results;
            }

            for (const user of recipients) {
                const userID = user.userID;
                const userEmail = email || user.email;
                const userPhone = sms || user.phone;

                // Get user preferences
                const { preferences } = await this.getUserPreferences(userID, event, rule);

                if (!rule || !rule.enabled) {
                    results.push({ success: false, userID, reason: 'Rule is disabled or not found' });
                    continue;
                }

                const notificationData = { event, ...data, ...metadata };
                const formattedMessage = await this.formatMessage(message || rule.messageTemplate, notificationData);

                // Send in-app notification
                if (rule.channels.inApp && preferences.inApp) {
                    const inAppResult = await this.storeNotification({
                        userID,
                        type: type || rule.type,
                        message: formattedMessage,
                        channel: 'in-app',
                        event,
                        rule,
                    });
                    if (inAppResult) {
                        results.push({ success: true, userID, method: 'inApp', notificationID: inAppResult.notificationID });
                    }
                }

                // Send email notification
                if (rule.channels.email && preferences.email && userEmail) {
                    const emailResult = await this.sendEmailNotification(
                        userEmail,
                        `Notification: ${event}`,
                        formattedMessage,
                        data,
                        metadata
                    );
                    const emailNotification = await this.storeNotification({
                        userID,
                        type: type || rule.type,
                        message: formattedMessage,
                        channel: 'email',
                        event,
                        rule,
                    });
                    results.push({ ...emailResult, userID, notificationID: emailNotification?.notificationID });
                }

                // Send SMS notification
                if (rule.channels.sms && preferences.sms && userPhone) {
                    const smsResult = await this.sendSMSNotification(
                        userPhone,
                        formattedMessage,
                        data,
                        metadata
                    );
                    const smsNotification = await this.storeNotification({
                        userID,
                        type: type || rule.type,
                        message: formattedMessage,
                        channel: 'sms',
                        event,
                        rule,
                    });
                    results.push({ ...smsResult, userID, notificationID: smsNotification?.notificationID });
                }
            }

            return results;
        } catch (error) {
            console.error('Failed to send notification:', error.message);
            return [{ success: false, reason: error.message }];
        }
    }

    // Get user preferences for an event
    async getUserPreferences(userID, event, rule) {
        try {
            const preference = await NotificationPreference.findOne({ where: { userID } });
            const defaultPrefs = {
                email: rule?.channels?.email || false,
                sms: rule?.channels?.sms || false,
                inApp: rule?.channels?.inApp || true,
            };

            if (!preference || !preference.preferences[event]) {
                return { preferences: defaultPrefs };
            }

            const userPrefs = preference.preferences[event];
            return {
                preferences: {
                    email: rule.priority === 'high' ? true : userPrefs.email,
                    sms: rule.priority === 'high' ? true : userPrefs.sms,
                    inApp: rule.priority === 'high' ? true : userPrefs.inApp,
                },
            };
        } catch (error) {
            console.error('Failed to get user preferences:', error.message);
            return { preferences: { email: false, sms: false, inApp: true } };
        }
    }
}

module.exports = new NotificationService();