const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notificationController');
const { requirePermission } = require('../config/security');

/**
 * @swagger
 * tags:
 *   name: Notification Rules
 *   description: API endpoints for managing notification rules
 *   name: Notifications
 *   description: API endpoints for managing notifications and preferences
 */

/**
 * @swagger
 * /notifications/rules:
 *   post:
 *     summary: Create a new notification rule
 *     tags: [Notification Rules]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event
 *               - type
 *               - channels
 *             properties:
 *               event:
 *                 type: string
 *                 description: The event that triggers the notification
 *                 example: "ai:anomaly_detected"
 *               type:
 *                 type: string
 *                 description: The type of notification
 *                 example: "ai"
 *               recipients:
 *                 type: object
 *                 properties:
 *                   roles:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: List of role names for recipients
 *                     example: ["admin"]
 *                   userIDs:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: List of user IDs for recipients
 *                     example: ["user1"]
 *               channels:
 *                 type: object
 *                 required:
 *                   - email
 *                   - sms
 *                   - inApp
 *                 properties:
 *                   email:
 *                     type: boolean
 *                     description: Enable email notifications
 *                     example: true
 *                   sms:
 *                     type: boolean
 *                     description: Enable SMS notifications
 *                     example: false
 *                   inApp:
 *                     type: boolean
 *                     description: Enable in-app notifications
 *                     example: true
 *               conditions:
 *                 type: object
 *                 description: Conditions for triggering the rule
 *                 example: { "threshold": 0.9 }
 *               messageTemplate:
 *                 type: string
 *                 description: Template for the notification message
 *                 example: "Anomaly detected in {dataType}"
 *               enabled:
 *                 type: boolean
 *                 description: Whether the rule is enabled
 *                 default: true
 *                 example: true
 *               priority:
 *                 type: string
 *                 enum: ["high", "normal"]
 *                 description: Priority of the rule
 *                 default: "normal"
 *                 example: "normal"
 *     responses:
 *       201:
 *         description: Notification rule created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ruleID:
 *                   type: string
 *                   description: Unique identifier for the rule
 *                 event:
 *                   type: string
 *                   description: The event that triggers the notification
 *                 type:
 *                   type: string
 *                   description: The type of notification
 *                 recipients:
 *                   type: object
 *                   description: Recipients of the notification
 *                 channels:
 *                   type: object
 *                   description: Notification channels
 *                 conditions:
 *                   type: object
 *                   description: Conditions for triggering the rule
 *                 messageTemplate:
 *                   type: string
 *                   description: Template for the notification message
 *                 enabled:
 *                   type: boolean
 *                   description: Whether the rule is enabled
 *                 priority:
 *                   type: string
 *                   description: Priority of the rule
 *                 creatorID:
 *                   type: string
 *                   description: ID of the user who created the rule
 *       400:
 *         description: Missing or invalid request fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Please fill in all required fields."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'manage_notification_rules' required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.post('/rules', requirePermission('manage_notification_rules'), NotificationController.createRule);

/**
 * @swagger
 * /notifications/rules/{ruleID}:
 *   put:
 *     summary: Update a notification rule by ID
 *     tags: [Notification Rules]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: ruleID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the notification rule to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 description: The event that triggers the notification
 *                 example: "ai:anomaly_detected"
 *               type:
 *                 type: string
 *                 description: The type of notification
 *                 example: "ai"
 *               recipients:
 *                 type: object
 *                 properties:
 *                   roles:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: List of role names for recipients
 *                     example: ["admin"]
 *                   userIDs:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: List of user IDs for recipients
 *                     example: ["user1"]
 *               channels:
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: boolean
 *                     description: Enable email notifications
 *                     example: true
 *                   sms:
 *                     type: boolean
 *                     description: Enable SMS notifications
 *                     example: false
 *                   inApp:
 *                     type: boolean
 *                     description: Enable in-app notifications
 *                     example: true
 *               conditions:
 *                 type: object
 *                 description: Conditions for triggering the rule
 *                 example: { "threshold": 0.9 }
 *               messageTemplate:
 *                 type: string
 *                 description: Template for the notification message
 *                 example: "Anomaly detected in {dataType}"
 *               enabled:
 *                 type: boolean
 *                 description: Whether the rule is enabled
 *                 example: true
 *               priority:
 *                 type: string
 *                 enum: ["high", "normal"]
 *                 description: Priority of the rule
 *                 example: "normal"
 *     responses:
 *       200:
 *         description: Notification rule updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ruleID:
 *                   type: string
 *                   description: Unique identifier for the rule
 *                 event:
 *                   type: string
 *                   description: The event that triggers the notification
 *                 type:
 *                   type: string
 *                   description: The type of notification
 *                 recipients:
 *                   type: object
 *                   description: Recipients of the notification
 *                 channels:
 *                   type: object
 *                   description: Notification channels
 *                 conditions:
 *                   type: object
 *                   description: Conditions for triggering the rule
 *                 messageTemplate:
 *                   type: string
 *                   description: Template for the notification message
 *                 enabled:
 *                   type: boolean
 *                   description: Whether the rule is enabled
 *                 priority:
 *                   type: string
 *                   description: Priority of the rule
 *       400:
 *         description: Missing or invalid request fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Please fill in all required fields."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'manage_notification_rules' required"
 *       404:
 *         description: Notification rule not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid notification rule."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.put('/rules/:ruleID', requirePermission('manage_notification_rules'), NotificationController.updateRule);

/**
 * @swagger
 * /notifications/rules/{ruleID}:
 *   delete:
 *     summary: Delete a notification rule by ID
 *     tags: [Notification Rules]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: ruleID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the notification rule to delete
 *     responses:
 *       200:
 *         description: Notification rule deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Notification rule deleted successfully."
 *       400:
 *         description: Missing or invalid request fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Please fill in all required fields."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'manage_notification_rules' required"
 *       404:
 *         description: Notification rule not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid notification rule."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.delete('/rules/:ruleID', requirePermission('manage_notification_rules'), NotificationController.deleteRule);

/**
 * @swagger
 * /notifications/rules:
 *   get:
 *     summary: Retrieve all notification rules
 *     tags: [Notification Rules]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of all notification rules
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   ruleID:
 *                     type: string
 *                     description: Unique identifier for the rule
 *                   event:
 *                     type: string
 *                     description: The event that triggers the notification
 *                   type:
 *                     type: string
 *                     description: The type of notification
 *                   recipients:
 *                     type: object
 *                     description: Recipients of the notification
 *                   channels:
 *                     type: object
 *                     description: Notification channels
 *                   conditions:
 *                     type: object
 *                     description: Conditions for triggering the rule
 *                   messageTemplate:
 *                     type: string
 *                     description: Template for the notification message
 *                   enabled:
 *                     type: boolean
 *                     description: Whether the rule is enabled
 *                   priority:
 *                     type: string
 *                     description: Priority of the rule
 *                   creatorID:
 *                     type: string
 *                     description: ID of the user who created the rule
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'view_notification_rules' required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.get('/rules', requirePermission('view_notification_rules'), NotificationController.getRules);

/**
 * @swagger
 * /notifications/types:
 *   get:
 *     summary: Retrieve all unique notification types
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of unique notification types
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 types:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of unique notification types
 *                   example: ["ai", "notification"]
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.get('/types', NotificationController.getNotificationTypes);

/**
 * @swagger
 * /notifications/preferences:
 *   put:
 *     summary: Update user notification preferences
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preferences:
 *                 type: object
 *                 additionalProperties:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: boolean
 *                       description: Enable email notifications for the event
 *                       example: true
 *                     sms:
 *                       type: boolean
 *                       description: Enable SMS notifications for the event
 *                       example: false
 *                     inApp:
 *                       type: boolean
 *                       description: Enable in-app notifications for the event
 *                       example: true
 *                 description: Notification preferences by event
 *                 example:
 *                   ai:anomaly_detected: { email: true, sms: false, inApp: true }
 *                   notification_rule:created: { email: false, sms: false, inApp: true }
 *     responses:
 *       200:
 *         description: Notification preferences updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 preferences:
 *                   type: object
 *                   description: Updated notification preferences
 *                 availableEvents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       event:
 *                         type: string
 *                         description: The event name
 *                       isCustomizable:
 *                         type: boolean
 *                         description: Whether the event preferences are customizable
 *       400:
 *         description: Missing or invalid request fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Please fill in all required fields."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.put('/preferences', NotificationController.updatePreferences);

/**
 * @swagger
 * /notifications/preferences:
 *   get:
 *     summary: Retrieve user notification preferences
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User notification preferences retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 preferences:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       email:
 *                         type: boolean
 *                         description: Enable email notifications for the event
 *                       sms:
 *                         type: boolean
 *                         description: Enable SMS notifications for the event
 *                       inApp:
 *                         type: boolean
 *                         description: Enable in-app notifications for the event
 *                   description: Notification preferences by event
 *                 availableEvents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       event:
 *                         type: string
 *                         description: The event name
 *                       isCustomizable:
 *                         type: boolean
 *                         description: Whether the event preferences are customizable
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.get('/preferences', NotificationController.getPreferences);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Retrieve all notifications for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of user notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   notificationID:
 *                     type: string
 *                     description: Unique identifier for the notification
 *                   userID:
 *                     type: string
 *                     description: ID of the user receiving the notification
 *                   type:
 *                     type: string
 *                     description: Type of the notification
 *                   message:
 *                     type: string
 *                     description: Notification message
 *                   channel:
 *                     type: string
 *                     enum: ["in-app", "email", "sms"]
 *                     description: Delivery channel of the notification
 *                   status:
 *                     type: string
 *                     enum: ["pending", "sent", "read"]
 *                     description: Status of the notification
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                     description: Timestamp when the notification was created
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.get('/', NotificationController.getNotifications);

/**
 * @swagger
 * /notifications/{notificationID}/read:
 *   put:
 *     summary: Mark a notification as read
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the notification to mark as read
 *     responses:
 *       200:
 *         description: Notification marked as read successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notificationID:
 *                   type: string
 *                   description: Unique identifier for the notification
 *                 userID:
 *                   type: string
 *                   description: ID of the user receiving the notification
 *                 type:
 *                   type: string
 *                   description: Type of the notification
 *                 message:
 *                   type: string
 *                   description: Notification message
 *                 channel:
 *                   type: string
 *                   enum: ["in-app", "email", "sms"]
 *                   description: Delivery channel of the notification
 *                 status:
 *                   type: string
 *                   enum: ["pending", "sent", "read"]
 *                   description: Status of the notification
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   description: Timestamp when the notification was created
 *       400:
 *         description: Missing or invalid request fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Please fill in all required fields."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       404:
 *         description: Notification not found or unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Notification not found or unauthorized"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.put('/:notificationID/read', NotificationController.markNotificationAsRead);

/**
 * @swagger
 * /notifications/read-all:
 *   put:
 *     summary: Mark all notifications as read for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Marked 5 notifications as read."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.put('/read-all', NotificationController.markAllNotificationsAsRead);

/**
 * @swagger
 * /notifications/anomaly:
 *   post:
 *     summary: Trigger an anomaly notification
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dataType
 *               - anomalies
 *             properties:
 *               dataType:
 *                 type: string
 *                 description: Type of data where anomalies were detected
 *                 example: "timesheet"
 *               anomalies:
 *                 type: array
 *                 items:
 *                   type: object
 *                 description: List of detected anomalies
 *                 example: [{ id: "1", value: 100 }]
 *               userIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of user IDs to notify
 *                 example: ["user1"]
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of roles to notify
 *                 example: ["admin"]
 *               dynamicRecipients:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of dynamic recipient user IDs
 *                 example: ["user2"]
 *               triggeredByUserID:
 *                 type: string
 *                 description: ID of the user triggering the notification
 *                 example: "user3"
 *     responses:
 *       200:
 *         description: Anomaly notification triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       success:
 *                         type: boolean
 *                         description: Whether the notification was sent successfully
 *                       method:
 *                         type: string
 *                         description: Notification delivery method
 *                       reason:
 *                         type: string
 *                         description: Reason for failure, if applicable
 *                       userID:
 *                         type: string
 *                         description: ID of the user notified
 *                       notificationID:
 *                         type: string
 *                         description: ID of the stored notification
 *                 message:
 *                   type: string
 *                   example: "Anomaly notification sent successfully."
 *       400:
 *         description: Missing or invalid request fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Please fill in all required fields."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'trigger_notifications' required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.post('/anomaly', requirePermission('trigger_notifications'), NotificationController.notifyAnomaly);

/**
 * @swagger
 * /notifications/report:
 *   post:
 *     summary: Trigger a report notification
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - format
 *               - filters
 *             properties:
 *               format:
 *                 type: string
 *                 description: Format of the generated report
 *                 example: "pdf"
 *               filters:
 *                 type: object
 *                 description: Filters applied to the report
 *                 example: { "dateRange": "2025-01-01:2025-06-01" }
 *               userIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of user IDs to notify
 *                 example: ["user1"]
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of roles to notify
 *                 example: ["admin"]
 *               dynamicRecipients:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of dynamic recipient user IDs
 *                 example: ["user2"]
 *               triggeredByUserID:
 *                 type: string
 *                 description: ID of the user triggering the notification
 *                 example: "user3"
 *     responses:
 *       200:
 *         description: Report notification triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       success:
 *                         type: boolean
 *                         description: Whether the notification was sent successfully
 *                       method:
 *                         type: string
 *                         description: Notification delivery method
 *                       reason:
 *                         type: string
 *                         description: Reason for failure, if applicable
 *                       userID:
 *                         type: string
 *                         description: ID of the user notified
 *                       notificationID:
 *                         type: string
 *                         description: ID of the stored notification
 *                 message:
 *                   type: string
 *                   example: "Report notification sent successfully."
 *       400:
 *         description: Missing or invalid request fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Please fill in all required fields."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'trigger_notifications' required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.post('/report', requirePermission('trigger_notifications'), NotificationController.notifyReport);

module.exports = router;