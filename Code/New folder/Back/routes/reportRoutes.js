const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/reportController');
const { requirePermission } = require('../config/security');

router.post('/generate', requirePermission('generate_report'), ReportController.generateReport);
/**
 * @route POST /api/reports/generate
 * @desc Generate a report based on specified type, filters, and format
 * @access Private (requires 'generate_report' permission)
 * @param {string} reportType - Type of report (e.g., 'VisitSummary', 'Full')
 * @param {object} filters - Filters for the report (e.g., { dateRange: { start, end } })
 * @param {string} format - Format of the report ('pdf' or 'excel')
 * @returns {object} - { reportPath: string }
 */

router.post('/schedule', requirePermission('schedule_report'), ReportController.scheduleReport);
/**
 * @route POST /api/reports/schedule
 * @desc Schedule a recurring report
 * @access Private (requires 'schedule_report' permission)
 * @param {string} reportType - Type of report
 * @param {object} filters - Filters for the report
 * @param {string} format - Format of the report ('pdf' or 'excel')
 * @param {string} cronExpression - Cron expression for scheduling (e.g., '0 0 * * *')
 * @returns {object} - { message: string, scheduleID: string }
 */

router.get('/download', requirePermission('download_report'), ReportController.downloadReport);
/**
 * @route GET /api/reports/download
 * @desc Download a generated report file
 * @access Private (requires 'download_report' permission)
 * @param {string} file - Filename of the report (query parameter)
 * @returns {file} - The report file
 */

module.exports = router;