const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const AIController = require('../controllers/aiController');

/**
 * @swagger
 * /api/ai/timesheet/suggest:
 *   post:
 *     summary: Generate timesheet suggestions
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - supervisorId
 *               - weekStart
 *             properties:
 *               supervisorId:
 *                 type: string
 *                 description: The supervisor's user ID
 *               weekStart:
 *                 type: string
 *                 format: date
 *                 description: Start date of the week (YYYY-MM-DD)
 *               criteria:
 *                 type: object
 *                 description: Additional criteria for suggestions
 *     responses:
 *       200:
 *         description: Timesheet suggestions generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post(
    '/timesheet/suggest',
    requirePermission('access_ai_timesheet_suggestions'),
    AIController.suggestTimesheet
);

/**
 * @swagger
 * /api/ai/anomaly/detect:
 *   post:
 *     summary: Detect anomalies in data
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dataType
 *               - data
 *             properties:
 *               dataType:
 *                 type: string
 *                 enum: [timesheet, visit, receipt]
 *                 description: Type of data to analyze
 *               data:
 *                 type: array
 *                 items:
 *                   type: object
 *                 description: Data to analyze for anomalies
 *     responses:
 *       200:
 *         description: Anomalies detected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 anomalies:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post(
    '/anomaly/detect',
    requirePermission('access_ai_anomaly_detection'),
    AIController.detectAnomalies
);

/**
 * @swagger
 * /api/ai/report/generate:
 *   post:
 *     summary: Generate a report
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - filters
 *               - format
 *             properties:
 *               filters:
 *                 type: object
 *                 description: Filters for the report (e.g., date range, regions)
 *               format:
 *                 type: string
 *                 enum: [pdf, excel]
 *                 description: Report format
 *     responses:
 *       200:
 *         description: Report generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 report:
 *                   type: object
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post(
    '/report/generate',
    requirePermission('access_ai_reports'),
    AIController.generateReport
);

module.exports = router;