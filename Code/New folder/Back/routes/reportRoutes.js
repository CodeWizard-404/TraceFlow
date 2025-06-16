const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/reportController');
const { requirePermission } = require('../config/security');

/**
 * @swagger
 * /api/reports/generate:
 *   post:
 *     summary: Generate a report on demand
 *     description: Generates a report based on the specified type, filters, and format. Requires 'generate_report' permission.
 *     tags: [Reports]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reportType
 *               - format
 *             properties:
 *               reportType:
 *                 type: string
 *                 enum: ['VisitSummary', 'Timesheet', 'ReceiptBookInventory', 'StubCollection', 'UserActivity', 'Anomaly', 'AgentPerformance', 'RegionPerformance', 'Full']
 *                 description: The type of report to generate
 *               filters:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Filters for the report, structure depends on reportType
 *               format:
 *                 type: string
 *                 enum: ['pdf', 'excel']
 *                 description: The format of the report
 *     responses:
 *       200:
 *         description: Report generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Report generated successfully'
 *                 reportPath:
 *                   type: string
 *                   example: '/api/reports/download?file=report.pdf'
 *       400:
 *         description: Invalid input (e.g., invalid report type or format)
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       500:
 *         description: Internal server error
 */
router.post('/generate', requirePermission('generate_report'), ReportController.generateReport);

/**
 * @swagger
 * /api/reports/schedule:
 *   post:
 *     summary: Schedule a report to be generated periodically
 *     description: Schedules a report to be generated based on the specified type, filters, format, and cron expression. Requires 'schedule_report' permission.
 *     tags: [Reports]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reportType
 *               - format
 *               - cronExpression
 *             properties:
 *               reportType:
 *                 type: string
 *                 enum: ['VisitSummary', 'Timesheet', 'ReceiptBookInventory', 'StubCollection', 'UserActivity', 'Anomaly', 'AgentPerformance', 'RegionPerformance', 'Full']
 *                 description: The type of report to schedule
 *               filters:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Filters for the report, structure depends on reportType
 *               format:
 *                 type: string
 *                 enum: ['pdf', 'excel']
 *                 description: The format of the report
 *               cronExpression:
 *                 type: string
 *                 description: Cron expression for scheduling the report (e.g., '0 0 * * *' for daily at midnight)
 *     responses:
 *       200:
 *         description: Report scheduled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Report scheduled successfully'
 *                 scheduleID:
 *                   type: string
 *                   example: '123e4567-e89b-12d3-a456-426614174000'
 *       400:
 *         description: Invalid input (e.g., invalid report type, format, or cron expression)
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       500:
 *         description: Internal server error
 */
router.post('/schedule', requirePermission('schedule_report'), ReportController.scheduleReport);

/**
 * @swagger
 * /api/reports/download:
 *   get:
 *     summary: Download a generated report
 *     description: Downloads a generated report file. Requires 'download_report' permission.
 *     tags: [Reports]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: file
 *         required: true
 *         schema:
 *           type: string
 *         description: The filename of the report to download
 *     responses:
 *       200:
 *         description: The report file
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid file name
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Report file not found
 *       500:
 *         description: Internal server error
 */
router.get('/download', requirePermission('download_report'), ReportController.downloadReport);

/**
 * @swagger
 * /api/reports/schedules:
 *   get:
 *     summary: List all scheduled reports
 *     description: Retrieves a list of all scheduled reports. Requires 'view_report_schedules' permission.
 *     tags: [Reports]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of scheduled reports
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   scheduleID:
 *                     type: string
 *                   reportType:
 *                     type: string
 *                   format:
 *                     type: string
 *                   cronExpression:
 *                     type: string
 *                   createdBy:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   Creator:
 *                     type: object
 *                     properties:
 *                       userID:
 *                         type: string
 *                       firstname:
 *                         type: string
 *                       lastname:
 *                         type: string
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       500:
 *         description: Internal server error
 */
router.get('/schedules', requirePermission('view_report_schedules'), ReportController.listSchedules);

/**
 * @swagger
 * /api/reports/generated:
 *   get:
 *     summary: List all generated reports
 *     description: Retrieves a list of all generated reports. Requires 'view_generated_reports' permission.
 *     tags: [Reports]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of generated reports
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   generatedReportID:
 *                     type: string
 *                   reportType:
 *                     type: string
 *                   format:
 *                     type: string
 *                   filePath:
 *                     type: string
 *                   generatedAt:
 *                     type: string
 *                     format: date-time
 *                   generatedBy:
 *                     type: string
 *                   scheduleID:
 *                     type: string
 *                   Generator:
 *                     type: object
 *                     properties:
 *                       userID:
 *                         type: string
 *                       firstname:
 *                         type: string
 *                       lastname:
 *                         type: string
 *                   Schedule:
 *                     type: object
 *                     properties:
 *                       scheduleID:
 *                         type: string
 *                       reportType:
 *                         type: string
 *                       format:
 *                         type: string
 *                       cronExpression:
 *                         type: string
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       500:
 *         description: Internal server error
 */
router.get('/generated', requirePermission('view_generated_reports'), ReportController.listGeneratedReports);

/**
 * @swagger
 * /api/reports/schedules/{scheduleID}:
 *   delete:
 *     summary: Delete a scheduled report
 *     description: Deletes a specific scheduled report by ID. Requires 'delete_report_schedule' permission.
 *     tags: [Reports]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the schedule to delete
 *     responses:
 *       200:
 *         description: Schedule deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Schedule deleted successfully'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Schedule not found
 *       500:
 *         description: Internal server error
 */
router.delete('/schedules/:scheduleID', requirePermission('delete_report_schedule'), ReportController.deleteSchedule);

/**
 * @swagger
 * /api/reports/generated/{reportID}:
 *   delete:
 *     summary: Delete a generated report
 *     description: Deletes a specific generated report by ID. Requires 'delete_generated_report' permission.
 *     tags: [Reports]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: reportID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the generated report to delete
 *     responses:
 *       200:
 *         description: Generated report deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Generated report deleted successfully'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Generated report not found
 *       500:
 *         description: Internal server error
 */
router.delete('/generated/:reportID', requirePermission('delete_generated_report'), ReportController.deleteGeneratedReport);

module.exports = router;