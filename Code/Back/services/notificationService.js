const io = require('../utils/socket'); // Socket.io for real-time WebSocket notifications
const { sendSMS } = require('../config/sms'); // SMS sending utility
const { sendEmail } = require('../config/smtp'); // Email sending utility
const { Notification, NotificationPreference, NotificationRule, User, Role } = require('../models'); // Sequelize models
const { Op } = require('sequelize'); // Sequelize operators for queries
const { getRedisClient, getRedisSubClient } = require('../config/redis'); // Redis client utilities
const RedisUtils = require('../utils/redisUtils'); // Redis helper utilities
const logger = require('../utils/logger'); // Logger import
const { v4: uuidv4 } = require('uuid'); // UUID for requestID

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

        logger.debug('Initializing NotificationService with Redis clients');

        // Subscribe to Redis 'notifications' channel for real-time messages
        this.redisSub.subscribe('notifications', (err) => {
            if (err) {
                logger.error('Failed to subscribe to notifications:', err.message);
            } else {
                logger.debug('Subscribed to notifications channel');
            }
        });

        // Handle incoming Redis messages
        this.redisSub.on('message', (channel, message) => {
            if (channel === 'notifications') {
                try {
                    logger.debug(`Received Redis message on channel ${channel}: ${message}`);
                    const { room, data } = JSON.parse(message);
                    io.to(room).emit('notification', data);
                    logger.debug(`Emitted notification to room ${room}`);
                } catch (error) {
                    logger.error('Failed to process notification message:', error.message);
                }
            }
        });
    }

    // Create a new notification rule
    async createRule(data, creatorID, logInfo) {
        logger.debug(`Creating notification rule for creatorID ${creatorID}: ${JSON.stringify(data)}`);
        const { event, type, recipients, channels, conditions, messageTemplate, enabled, priority } = data;

        // Validate channels
        if (channels.websocket !== undefined || !['email', 'sms', 'inApp'].every(c => typeof channels[c] === 'boolean')) {
            logger.debug('Invalid channels detected');
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_CHANNELS), { status: 400 });
        }

        // Validate priority
        if (priority && !['high', 'normal'].includes(priority)) {
            logger.debug(`Invalid priority: ${priority}`);
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
        logger.debug(`Created rule with ID ${rule.ruleID}`);

        // Handle high-priority rules
        if (rule.priority === 'high') {
            logger.debug(`Handling priority change for high-priority rule ${rule.ruleID}`);
            await this.handlePriorityChange(rule);
        }
        return rule;
    }

    // Update an existing rule
    async updateRule(ruleID, data, logInfo) {
        logger.debug(`Updating rule ${ruleID} with data: ${JSON.stringify(data)}`);
        const { event, type, recipients, channels, conditions, messageTemplate, enabled, priority } = data;

        // Validate channels
        if (channels.websocket !== undefined || !['email', 'sms', 'inApp'].every(c => typeof channels[c] === 'boolean')) {
            logger.debug('Invalid channels detected');
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_CHANNELS), { status: 400 });
        }

        // Validate priority
        if (priority && !['high', 'normal'].includes(priority)) {
            logger.debug(`Invalid priority: ${priority}`);
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_PRIORITY), { status: 400 });
        }

        // Find and update rule
        const rule = await NotificationRule.findByPk(ruleID);
        if (!rule) {
            logger.debug(`Rule ${ruleID} not found`);
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
        logger.debug(`Updated rule ${ruleID}`);

        // Handle priority change to high
        if (wasNormalPriority && rule.priority === 'high') {
            logger.debug(`Handling priority change to high for rule ${ruleID}`);
            await this.handlePriorityChange(rule);
        }

        return rule;
    }

    // Delete a rule
    async deleteRule(ruleID, logInfo) {
        logger.debug(`Deleting rule ${ruleID}`);
        const rule = await NotificationRule.findByPk(ruleID);
        if (!rule) {
            logger.debug(`Rule ${ruleID} not found`);
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_RULE), { status: 404 });
        }
        await rule.destroy();
        logger.debug(`Deleted rule ${ruleID}`);
        return { message: 'Notification rule deleted successfully.' };
    }

    // Get all rules
    async getRules(logInfo) {
        logger.debug('Fetching all notification rules');
        const rules = await NotificationRule.findAll();
        logger.debug(`Retrieved ${rules.length} rules`);
        return rules;
    }

    // Get unique notification types
    async getNotificationTypes(logInfo) {
        logger.debug('Fetching unique notification types');
        const rules = await NotificationRule.findAll({
            attributes: ['type'],
            group: ['type'],
        });
        const types = rules.map(rule => rule.type);
        logger.debug(`Retrieved ${types.length} notification types`);
        return types;
    }

    // Get user notification preferences and available events
    async getPreferences(userID, logInfo) {
        logger.debug(`Fetching preferences for user ${userID}`);
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

        logger.debug(`Retrieved preferences for user ${userID}`);
        return { preferences: sanitizedPreferences, availableEvents };
    }

    // Get all notifications for a user
    async getNotifications(userID, logInfo) {
        logger.debug(`Fetching notifications for user ${userID}`);
        const notifications = await Notification.findAll({
            where: { userID },
            order: [['createdAt', 'DESC']],
        });
        logger.debug(`Retrieved ${notifications.length} notifications for user ${userID}`);
        return notifications;
    }

    // Mark a single notification as read
    async markNotificationAsRead(notificationID, userID, logInfo) {
        logger.debug(`Marking notification ${notificationID} as read for user ${userID}`);
        const notification = await Notification.findByPk(notificationID);
        if (!notification || notification.userID !== userID) {
            logger.debug(`Notification ${notificationID} not found or unauthorized for user ${userID}`);
            throw Object.assign(new Error('Notification not found or unauthorized'), { status: 404 });
        }
        await notification.update({ status: 'read' });
        logger.debug(`Marked notification ${notificationID} as read`);
        return notification;
    }

    // Mark all notifications for a user as read
    async markAllNotificationsAsRead(userID, logInfo) {
        logger.debug(`Marking all notifications as read for user ${userID}`);
        const updatedCount = await Notification.update(
            { status: 'read' },
            {
                where: {
                    userID,
                    status: { [Op.in]: ['pending', 'sent'] },
                },
            }
        );
        logger.debug(`Marked ${updatedCount[0]} notifications as read for user ${userID}`);
        return { message: `Marked ${updatedCount[0]} notifications as read.` };
    }

    // DEPRECATED: Redirect createNotification to triggerNotification
    async createNotification(data, logInfo) {
        logger.debug(`DEPRECATED: createNotification called, redirecting to triggerNotification: ${JSON.stringify(data)}`);
        const { event, data: notificationData, roles, userIDs, type, message, email, sms, dynamicRecipients, triggeredByUserID } = data;
        const results = await this.triggerNotification({
            event,
            data: notificationData,
            metadata: { customMessage: message, triggeredBy: email || data?.triggeredBy },
            roles: roles || [],
            userIDs: userIDs || [],
            dynamicRecipients,
            triggeredByUserID,
            type: type || event.split(':')[0],
            customMessage: message,
            email,
            sms,
        });
        logger.debug(`Notification sent with results: ${JSON.stringify(results)}`);
        return { results, message: 'Notification sent successfully.' };
    }

    // Notify for anomaly detection
    async notifyAnomaly(data, userEmail, logInfo) {
        logger.debug(`Notifying anomaly for userEmail ${userEmail}: ${JSON.stringify(data)}`);
        const { dataType, anomalies, userIDs, roles, dynamicRecipients, triggeredByUserID } = data;
        const results = await this.triggerNotification({
            event: 'ai:anomaly_detected',
            data: { dataType, anomalyCount: anomalies.length },
            metadata: { triggeredBy: userEmail, anomalies },
            roles: roles || [],
            userIDs: userIDs || [],
            dynamicRecipients,
            triggeredByUserID,
            type: 'ai',
        });
        logger.debug(`Anomaly notification results: ${JSON.stringify(results)}`);
        return { results, message: 'Anomaly notification sent successfully.' };
    }

    // Notify for report generation
    async notifyReport(data, userEmail, logInfo) {
        logger.debug(`Notifying report for userEmail ${userEmail}: ${JSON.stringify(data)}`);
        const { format, filters, userIDs, roles, dynamicRecipients, triggeredByUserID } = data;
        const results = await this.triggerNotification({
            event: 'ai:report_generated',
            data: { format, filters },
            metadata: { triggeredBy: userEmail },
            roles: roles || [],
            userIDs: userIDs || [],
            dynamicRecipients,
            triggeredByUserID,
            type: 'ai',
        });
        logger.debug(`Report notification results: ${JSON.stringify(results)}`);
        return { results, message: 'Report notification sent successfully.' };
    }

    // Send WebSocket notification to specific rooms
    async sendWebSocketNotification(event, data, roles = [], userIDs = []) {
        logger.debug(`Sending WebSocket notification for event ${event}`);
        try {
            if (!io || !io.sockets) {
                logger.debug('WebSocket server not initialized');
                return { success: false, method: 'WebSocket', reason: 'Server not initialized' };
            }
            const payload = { event, data, timestamp: new Date().toISOString() };
            const rooms = [...new Set([...roles.map(r => r.toLowerCase()), ...userIDs, 'default-roles-traceflow'].filter(Boolean))];
            if (rooms.length === 0) {
                logger.debug('No rooms to notify via WebSocket');
                return { success: true, method: 'WebSocket', reason: 'No rooms to notify' };
            }
            rooms.forEach((room) => {
                io.to(room).emit(event, payload);
                logger.debug(`Emitted WebSocket notification to room ${room}`);
            });
            return { success: true, method: 'WebSocket' };
        } catch (error) {
            logger.error('Failed to send WebSocket notification:', error.message);
            return { success: false, method: 'WebSocket', reason: error.message };
        }
    }

    // Send email notification
    async sendEmailNotification(to, subject, message, data = {}, metadata = {}) {
        logger.debug(`Sending email notification to ${to} with subject ${subject}`);
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
            logger.debug(`Email notification sent to ${to}`);
            return { success: true, method: 'Email' };
        } catch (error) {
            logger.error('Failed to send email notification:', error.message);
            return { success: false, method: 'Email', reason: error.message };
        }
    }

    // Send SMS notification
    async sendSMSNotification(to, message, data = {}, metadata = {}) {
        logger.debug(`Sending SMS notification to ${to}`);
        try {
            const resolvedMessage = await Promise.resolve(message);
            let smsMessage = `${resolvedMessage}`;
            if (data && Object.keys(data).length) {
                const keyDetail = Object.entries(data)[0];
                smsMessage += ` (${keyDetail[0]}: ${keyDetail[1]})`;
            }
            smsMessage += `. Check traceflow.app`;
            const result = await sendSMS(to, smsMessage, 'notification');
            logger.debug(`SMS notification sent to ${to}`);
            return result;
        } catch (error) {
            logger.error('Failed to send SMS notification:', error.message);
            return { success: false, method: 'SMS', reason: error.message };
        }
    }

    // Store notification in database with deduplication
    async storeNotification({ userID, type, message, channel, event, rule, requestID }) {
        logger.debug(`Storing notification for user ${userID}, event ${event}, channel ${channel}, requestID ${requestID}`);
        try {
            if (!rule || !rule.enabled) {
                logger.debug(`Rule is disabled or not found for event ${event}`);
                return null;
            }

            // Check user preferences
            const { preferences } = await this.getUserPreferences(userID, event, rule);
            if (channel === 'in-app' && !preferences.inApp) return null;
            if (channel === 'email' && !preferences.email) return null;
            if (channel === 'sms' && !preferences.sms) return null;

            const notificationMessage = await Promise.resolve(message).then(String);
            if (!notificationMessage) {
                logger.debug(`Empty notification message for user ${userID}`);
                return null;
            }

            // Create a unique key for deduplication based on userID and requestID
            const dedupKey = `notif:${userID}:${event}:${channel}:${notificationMessage}:${requestID}`;
            const exists = await this.redis.get(dedupKey);
            if (exists) {
                logger.debug(`Duplicate notification skipped for user ${userID}, event ${event}, channel ${channel}, requestID ${requestID}`);
                return null;
            }

            // Store notification and set deduplication key
            const notification = await Notification.create({
                userID,
                type,
                message: notificationMessage,
                channel,
                status: 'pending',
            });

            await this.redis.set(dedupKey, '1', 'EX', 60);
            logger.debug(`Stored notification ${notification.notificationID} for user ${userID}`);

            // Send in-app notification via WebSocket
            if (channel === 'in-app' && preferences.inApp) {
                await this.updateNotificationStatus(notification.notificationID, 'sent');
                await this.sendWebSocketNotification('notification:created', { data: notification }, [], [userID]);
                logger.debug(`Sent in-app notification ${notification.notificationID} to user ${userID}`);
            }

            return notification;
        } catch (error) {
            logger.error(`Failed to store notification for user ${userID}:`, error.message);
            return null;
        }
    }

    // Update notification status and notify via WebSocket
    async updateNotificationStatus(notificationID, status) {
        logger.debug(`Updating notification ${notificationID} status to ${status}`);
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
            logger.debug(`Updated notification ${notificationID} status and notified user ${notification.userID}`);
        }
    }

    // Create a default disabled rule for an event
    async createDefaultDisabledRule({ event, data, metadata = {} }) {
        logger.debug(`Creating default disabled rule for event ${event}`);
        try {
            if (!event || !data) return null;
            const existingRule = await NotificationRule.findOne({ where: { event } });
            if (existingRule) {
                logger.debug(`Existing rule found for event ${event}`);
                return existingRule;
            }
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
            logger.debug(`Created default rule ${rule.ruleID} for event ${event}`);
            return rule;
        } catch (error) {
            logger.error('Failed to create default rule:', error.message);
            return null;
        }
    }

    // Handle priority changes for high-priority rules
    async handlePriorityChange(rule) {
        logger.debug(`Handling priority change for rule ${rule.ruleID}`);
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
                logger.debug(`Cleared preferences for user ${pref.userID} for event ${rule.event}`);
            }
        }
    }

    // Trigger a notification for an event with customizable recipients
    async triggerNotification({ event, data, metadata = {}, roles = [], userIDs = [], dynamicRecipients = [], triggeredByUserID, type, customMessage, email, sms, requestID = uuidv4() }) {
        logger.debug(`Triggering notification for event ${event}, requestID ${requestID}`);
        try {
            // Fetch all users and roles for WebSocket rooms
            const allUsers = await User.findAll();
            const allRoles = await Role.findAll();
            const userIDsAll = allUsers.map(user => user.userID);
            const roleNames = allRoles.map(role => role.name);

            // Send WebSocket notification to all relevant rooms
            const triggerEventPayload = { event, data, timestamp: new Date().toISOString() };
            await this.sendWebSocketNotification(event, triggerEventPayload, roleNames, userIDsAll);
            logger.debug(`Sent WebSocket notification to all rooms for event ${event}`);

            // Fetch all rules for the event
            const allRules = await NotificationRule.findAll({ where: { event } });
            for (const rule of allRules) {
                await this.handlePriorityChange(rule);
                logger.debug(`Handled priority change for rule ${rule.ruleID}`);
            }

            // Get enabled rules
            const rules = await NotificationRule.findAll({ where: { event, enabled: true } });
            if (!rules.length && !dynamicRecipients.length) {
                const defaultRule = await this.createDefaultDisabledRule({ event, data, metadata });
                if (defaultRule && defaultRule.enabled) {
                    await this.handlePriorityChange(defaultRule);
                    rules.push(defaultRule);
                    logger.debug(`Created and added default rule ${defaultRule.ruleID}`);
                } else {
                    logger.debug(`No enabled rules or dynamic recipients for event ${event}, only WebSocket sent`);
                    return [{ success: true, method: 'WebSocket', reason: 'No enabled rules or dynamic recipients, WebSocket sent' }];
                }
            }

            const results = [];
            // Handle recipients based on rules
            for (const rule of rules) {
                let allRecipients = [];
                let dynamicUsersRoles = new Set();
                let ruleRoles = (rule.recipients.roles || []);

                logger.debug(`Processing rule ${rule.ruleID} with recipients: ${JSON.stringify(rule.recipients)}`);

                // If dynamic recipients are provided, get their roles and filter
                if (dynamicRecipients.length) {
                    const dynamicUsersWithRoles = await User.findAll({
                        where: { userID: { [Op.in]: dynamicRecipients } },
                        include: [{
                            model: Role,
                            through: { attributes: [] },
                            required: false
                        }],
                    });
                    logger.debug(`Resolved ${dynamicUsersWithRoles.length} dynamic users: ${dynamicUsersWithRoles.map(u => u.userID)}`);
                    // Collect roles of dynamic recipients
                    dynamicUsersWithRoles.forEach(user => {
                        if (user.Roles && Array.isArray(user.Roles)) {
                            user.Roles.forEach(role => dynamicUsersRoles.add(role.name));
                        }
                    });
                    logger.debug(`Dynamic users roles: ${[...dynamicUsersRoles]}`);
                    // Filter dynamic users to those whose roles are in the rule
                    const filteredDynamicUsers = dynamicUsersWithRoles.filter(user =>
                        user.Roles && Array.isArray(user.Roles) &&
                        user.Roles.some(role => (rule.recipients.roles || []).includes(role.name))
                    );
                    logger.debug(`Filtered dynamic users: ${filteredDynamicUsers.map(u => u.userID)}`);
                    // Exclude roles of dynamic recipients from rule roles
                    ruleRoles = (rule.recipients.roles || []).filter(role => !dynamicUsersRoles.has(role));
                    logger.debug(`Rule roles after exclusion: ${ruleRoles}`);
                    const ruleUsers = await this.resolveRecipients({ roles: ruleRoles, userIDs: rule.recipients.userIDs || [] });
                    logger.debug(`Resolved rule users: ${ruleUsers.map(u => u.userID)}`);
                    allRecipients = [...filteredDynamicUsers, ...ruleUsers];
                } else {
                    // No dynamic recipients, use rule's recipients
                    allRecipients = await this.resolveRecipients({ roles: rule.recipients.roles || [], userIDs: rule.recipients.userIDs || [] });
                    logger.debug(`Resolved rule recipients (no dynamic): ${allRecipients.map(u => u.userID)}`);
                }

                logger.debug(`All recipients before deduplication: ${allRecipients.map(u => u.userID)}`);

                // Deduplicate recipients by userID
                let uniqueRecipients = Array.from(new Set(allRecipients.map(u => u.userID)))
                    .map(id => allRecipients.find(u => u.userID === id));

                logger.debug(`Unique recipients: ${uniqueRecipients.map(u => u.userID)}`);

                // Filter out the user who triggered the notification
                if (triggeredByUserID) {
                    uniqueRecipients = uniqueRecipients.filter(user => user.userID !== triggeredByUserID);
                    logger.debug(`Filtered out triggeredByUserID ${triggeredByUserID}`);
                }

                if (!uniqueRecipients.length) {
                    results.push({ success: false, reason: 'No valid recipients after filtering' });
                    logger.debug(`No valid recipients after filtering for rule ${rule.ruleID}`);
                    continue;
                }

                for (const user of uniqueRecipients) {
                    const messageData = { event, ...data, ...metadata };
                    const message = await this.formatMessage(customMessage || (rule.messageTemplate || event), messageData);
                    if (!message) {
                        logger.debug(`Invalid notification message for event ${event}`);
                        throw new Error(`Invalid notification message for event: ${event}`);
                    }

                    const result = await this.sendNotification({
                        event,
                        data,
                        roles: dynamicRecipients.includes(user.userID) ? rule.recipients.roles || [] : ruleRoles,
                        userIDs: dynamicRecipients.includes(user.userID) ? [] : [user.userID],
                        dynamicRecipients: dynamicRecipients.includes(user.userID) ? [user.userID] : [],
                        triggeredByUserID,
                        type: type || rule.type || event.split(':')[0],
                        message,
                        email: email || user.email,
                        sms: sms || user.phone,
                        metadata,
                        rule,
                        requestID,
                    });

                    results.push({ userID: user.userID, ruleID: rule.ruleID, result });
                    logger.debug(`Sent notification to user ${user.userID} for event ${event}`);
                }
            }

            logger.debug(`Trigger notification results: ${JSON.stringify(results)}`);
            return results;
        } catch (error) {
            logger.error('Failed to trigger notification:', error.message);
            return [{ success: false, reason: error.message }];
        }
    }

    // Resolve recipients from roles and user IDs
    async resolveRecipients({ roles = [], userIDs = [] }) {
        logger.debug(`Resolving recipients: roles=${JSON.stringify(roles)}, userIDs=${JSON.stringify(userIDs)}`);
        try {
            const users = new Set();
            if (roles.length) {
                const roleUsers = await User.findAll({
                    include: [{
                        model: Role,
                        where: { name: { [Op.in]: roles } },
                        through: { attributes: [] },
                    }],
                });
                roleUsers.forEach(user => users.add(user));
                logger.debug(`Resolved ${roleUsers.length} users from roles`);
            }
            if (userIDs.length) {
                const specificUsers = await User.findAll({
                    where: { userID: { [Op.in]: userIDs } },
                });
                specificUsers.forEach(user => users.add(user));
                logger.debug(`Resolved ${specificUsers.length} users from userIDs`);
            }
            const resolvedUsers = Array.from(users);
            logger.debug(`Total resolved users: ${resolvedUsers.length}`);
            return resolvedUsers;
        } catch (error) {
            logger.error('Failed to resolve recipients:', error.message);
            return [];
        }
    }

    // Resolve dynamic recipients
    async resolveDynamicRecipients(userIDs) {
        logger.debug(`Resolving dynamic recipients for userIDs: ${userIDs}`);
        try {
            if (!userIDs || !userIDs.length) return [];
            const users = await User.findAll({
                where: { userID: { [Op.in]: userIDs } },
            });
            logger.debug(`Resolved ${users.length} dynamic recipients`);
            return users;
        } catch (error) {
            logger.error('Failed to resolve dynamic recipients:', error.message);
            return [];
        }
    }

    // Format message template with data
    async formatMessage(template, data) {
        logger.debug(`Formatting message template: ${template}`);
        const resolvedData = {};
        for (const [key, value] of Object.entries(data)) {
            resolvedData[key] = await Promise.resolve(value);
        }
        const formattedMessage = template.replace(/{(\w+)}/g, (_, key) => resolvedData[key] || '');
        logger.debug(`Formatted message: ${formattedMessage}`);
        return formattedMessage;
    }

    // Send notification to recipients
    async sendNotification({ event, data, roles, userIDs, dynamicRecipients, triggeredByUserID, type, message, email, sms, metadata = {}, rule, requestID }) {
        logger.debug(`Sending notification for event ${event}, requestID ${requestID}`);
        try {
            const results = [];
            let recipients = [];

            // Resolve recipients based on dynamicRecipients or roles/userIDs
            if (dynamicRecipients && dynamicRecipients.length) {
                recipients = await this.resolveDynamicRecipients(dynamicRecipients);
                logger.debug(`Resolved ${recipients.length} dynamic recipients: ${recipients.map(u => u.userID)}`);
            } else {
                recipients = await this.resolveRecipients({ roles, userIDs });
                logger.debug(`Resolved ${recipients.length} recipients from roles/userIDs: ${recipients.map(u => u.userID)}`);
            }

            if (triggeredByUserID) {
                recipients = recipients.filter(user => user.userID !== triggeredByUserID);
                logger.debug(`Filtered out triggeredByUserID ${triggeredByUserID}`);
            }

            if (!recipients.length) {
                results.push({ success: false, reason: 'No valid recipients after filtering' });
                logger.debug('No valid recipients after filtering');
                return results;
            }

            for (const user of recipients) {
                const userID = user.userID;
                const userEmail = email || user.email;
                const userPhone = sms || user.phone;

                const { preferences } = await this.getUserPreferences(userID, event, rule);
                logger.debug(`User ${userID} preferences: ${JSON.stringify(preferences)}`);

                if (rule && !rule.enabled) {
                    results.push({ success: false, userID, reason: 'Rule is disabled' });
                    logger.debug(`Rule disabled for user ${userID}`);
                    continue;
                }

                const notificationData = { event, ...data, ...metadata };
                const formattedMessage = await this.formatMessage(message || (rule?.messageTemplate || event), notificationData);

                // Determine if preferences override rule channels (normal priority only)
                const usePreferences = rule?.priority === 'normal';
                const effectiveChannels = {
                    inApp: usePreferences ? preferences.inApp : rule?.channels.inApp || preferences.inApp,
                    email: usePreferences ? preferences.email : rule?.channels.email || preferences.email,
                    sms: usePreferences ? preferences.sms : rule?.channels.sms || preferences.sms,
                };

                // Send in-app notification
                if (effectiveChannels.inApp) {
                    const inAppResult = await this.storeNotification({
                        userID,
                        type: type || rule?.type || event.split(':')[0],
                        message: formattedMessage,
                        channel: 'in-app',
                        event,
                        rule,
                        requestID,
                    });
                    if (inAppResult) {
                        results.push({ success: true, userID, method: 'inApp', notificationID: inAppResult.notificationID });
                        logger.debug(`Stored in-app notification for user ${userID}`);
                    }
                }

                // Send email notification
                if (effectiveChannels.email && userEmail) {
                    const emailResult = await this.sendEmailNotification(
                        userEmail,
                        `Notification: ${event}`,
                        formattedMessage,
                        data,
                        metadata
                    );
                    const emailNotification = await this.storeNotification({
                        userID,
                        type: type || rule?.type || event.split(':')[0],
                        message: formattedMessage,
                        channel: 'email',
                        event,
                        rule,
                        requestID,
                    });
                    results.push({ ...emailResult, userID, notificationID: emailNotification?.notificationID });
                    logger.debug(`Sent email notification to ${userEmail}`);
                }

                // Send SMS notification
                if (effectiveChannels.sms && userPhone) {
                    const smsResult = await this.sendSMSNotification(
                        userPhone,
                        formattedMessage,
                        data,
                        metadata
                    );
                    const smsNotification = await this.storeNotification({
                        userID,
                        type: type || rule?.type || event.split(':')[0],
                        message: formattedMessage,
                        channel: 'sms',
                        event,
                        rule,
                        requestID,
                    });
                    results.push({ ...smsResult, userID, notificationID: smsNotification?.notificationID });
                    logger.debug(`Sent SMS notification to ${userPhone}`);
                }
            }

            logger.debug(`Notification results: ${JSON.stringify(results)}`);
            return results;
        } catch (error) {
            logger.error('Failed to send notification:', error.message);
            return [{ success: false, reason: error.message }];
        }
    }

    // Get user preferences for an event
    async getUserPreferences(userID, event, rule) {
        logger.debug(`Fetching preferences for user ${userID}, event ${event}`);
        try {
            const preference = await NotificationPreference.findOne({ where: { userID } });
            const defaultPrefs = {
                email: rule?.channels?.email || false,
                sms: rule?.channels?.sms || false,
                inApp: rule?.channels?.inApp || true,
            };

            if (!preference || !preference.preferences[event]) {
                logger.debug(`No preferences found for user ${userID}, using defaults`);
                return { preferences: defaultPrefs };
            }

            const userPrefs = preference.preferences[event];
            const preferences = {
                email: rule?.priority === 'high' ? true : userPrefs.email,
                sms: rule?.priority === 'high' ? true : userPrefs.sms,
                inApp: rule?.priority === 'high' ? true : userPrefs.inApp,
            };
            logger.debug(`Preferences for user ${userID}: ${JSON.stringify(preferences)}`);
            return { preferences };
        } catch (error) {
            logger.error('Failed to get user preferences:', error.message);
            return { preferences: { email: false, sms: false, inApp: true } };
        }
    }
}

module.exports = new NotificationService();