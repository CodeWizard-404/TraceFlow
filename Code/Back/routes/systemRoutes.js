const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const SystemController = require('../controllers/systemController');

router.get('/', requirePermission('view_logs'), SystemController.getLogs);
router.get('/category/:category', requirePermission('view_log_categories'), SystemController.getLogsByCategory);
router.post('/delete', requirePermission('delete_logs'), SystemController.deleteLogs);
router.post('/archive', requirePermission('archive_logs'), SystemController.archiveLogs);
router.get('/statistics', requirePermission('view_log_statistics'), SystemController.getLogStatistics);
router.get('/export', requirePermission('export_logs'), SystemController.exportLogs);
router.post('/clear', requirePermission('clear_logs'), SystemController.clearAllLogs);
router.get('/unique/:field', requirePermission('view_log_filters'), SystemController.getUniqueValues);
router.get('/health', requirePermission('view_logger_health'), SystemController.getLoggerHealth);
router.get('/metrics', requirePermission('view_logger_metrics'), SystemController.getLoggerMetrics);

module.exports = router;