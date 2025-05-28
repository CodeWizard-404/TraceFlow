// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/reportController');
const { requirePermission } = require('../config/security');

router.post('/generate', requirePermission('generate_report'), ReportController.generateReport);
router.post('/schedule', requirePermission('schedule_report'), ReportController.scheduleReport);
router.get('/download', requirePermission('download_report'), ReportController.downloadReport);

module.exports = router;