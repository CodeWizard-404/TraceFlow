const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notificationController');
const { requirePermission } = require('../config/security');

// Notification rule management
router.post('/rules', requirePermission('manage_notification_rules'), NotificationController.createRule);
router.put('/rules/:ruleID', requirePermission('manage_notification_rules'), NotificationController.updateRule);
router.delete('/rules/:ruleID', requirePermission('manage_notification_rules'), NotificationController.deleteRule);
router.get('/rules', requirePermission('view_notification_rules'), NotificationController.getRules);

// User notification preferences
router.get('/types', NotificationController.getNotificationTypes);
router.put('/preferences', NotificationController.updatePreferences);
router.get('/preferences', NotificationController.getPreferences);

// User notifications
router.get('/', NotificationController.getNotifications);
router.put('/:notificationID/read', NotificationController.markNotificationAsRead);
router.put('/read-all', NotificationController.markAllNotificationsAsRead);

module.exports = router;