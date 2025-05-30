// routes/reports.js
const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/reportController');
const { requirePermission } = require('../config/security');

router.post('/generate', requirePermission('generate_report'), ReportController.generateReport);
router.post('/schedule', requirePermission('schedule_report'), ReportController.scheduleReport);
router.get('/download', requirePermission('download_report'), ReportController.downloadReport);
router.get('/schedules', requirePermission('view_report_schedules'), ReportController.listSchedules);
router.get('/generated', requirePermission('view_generated_reports'), ReportController.listGeneratedReports);
router.delete('/schedules/:scheduleID', requirePermission('delete_report_schedule'), ReportController.deleteSchedule);
router.delete('/generated/:reportID', requirePermission('delete_generated_report'), ReportController.deleteGeneratedReport)


module.exports = router;