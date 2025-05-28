const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
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
    [
        check('supervisorId').notEmpty().withMessage('Supervisor ID is required'),
        check('weekStart').isDate().withMessage('Week start must be a valid date (YYYY-MM-DD)')
    ],
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
    [
        check('dataType').isIn(['timesheet', 'visit', 'receipt']).withMessage('Invalid data type'),
        check('data').isArray().notEmpty().withMessage('Data must be a non-empty array')
    ],
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
    [
        check('filters').isObject().withMessage('Filters must be an object'),
        check('format').isIn(['pdf', 'excel']).withMessage('Format must be pdf or excel')
    ],
    requirePermission('access_ai_reports'),
    AIController.generateReport
);

/**
 * @swagger
 * /api/ai/config:
 *   post:
 *     summary: Create a new AI configuration
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
 *               - modelName
 *               - anomalyThreshold
 *               - timesheetMaxSuggestions
 *             properties:
 *               modelName:
 *                 type: string
 *                 description: Name of the AI model
 *               anomalyThreshold:
 *                 type: number
 *                 description: Threshold for anomaly detection (0 to 1)
 *               timesheetMaxSuggestions:
 *                 type: integer
 *                 description: Maximum number of timesheet suggestions
 *               supervisorId:
 *                 type: string
 *                 description: Optional supervisor ID for specific configuration
 *     responses:
 *       201:
 *         description: AI configuration created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 configID:
 *                   type: string
 *                 modelName:
 *                   type: string
 *                 anomalyThreshold:
 *                   type: number
 *                 timesheetMaxSuggestions:
 *                   type: integer
 *                 supervisorId:
 *                   type: string
 *                   nullable: true
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
    '/config',
    [
        check('modelName').notEmpty().withMessage('Model name is required'),
        check('anomalyThreshold').isFloat({ min: 0, max: 1 }).withMessage('Anomaly threshold must be between 0 and 1'),
        check('timesheetMaxSuggestions').isInt({ min: 1 }).withMessage('Timesheet max suggestions must be a positive integer'),
        check('supervisorId').optional().notEmpty().withMessage('Supervisor ID must not be empty')
    ],
    requirePermission('manage_ai_config'),
    AIController.createAIConfig
);

/**
 * @swagger
 * /api/ai/config/{configID}:
 *   put:
 *     summary: Update an AI configuration
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: configID
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the AI configuration to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               modelName:
 *                 type: string
 *                 description: Name of the AI model
 *               anomalyThreshold:
 *                 type: number
 *                 description: Threshold for anomaly detection (0 to 1)
 *               timesheetMaxSuggestions:
 *                 type: integer
 *                 description: Maximum number of timesheet suggestions
 *     responses:
 *       200:
 *         description: AI configuration updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 configID:
 *                   type: string
 *                 modelName:
 *                   type: string
 *                 anomalyThreshold:
 *                   type: number
 *                 timesheetMaxSuggestions:
 *                   type: integer
 *                 supervisorId:
 *                   type: string
 *                   nullable: true
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Configuration not found
 *       500:
 *         description: Server error
 */
router.put(
    '/config/:configID',
    [
        check('modelName').optional().notEmpty().withMessage('Model name must not be empty'),
        check('anomalyThreshold').optional().isFloat({ min: 0, max: 1 }).withMessage('Anomaly threshold must be between 0 and 1'),
        check('timesheetMaxSuggestions').optional().isInt({ min: 1 }).withMessage('Timesheet max suggestions must be a positive integer')
    ],
    requirePermission('manage_ai_config'),
    AIController.updateAIConfig
);

/**
 * @swagger
 * /api/ai/config:
 *   get:
 *     summary: Retrieve an AI configuration
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: configID
 *         schema:
 *           type: string
 *         description: ID of the AI configuration
 *       - in: query
 *         name: supervisorId
 *         schema:
 *           type: string
 *         description: Supervisor ID to retrieve specific configuration
 *     responses:
 *       200:
 *         description: AI configuration retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 configID:
 *                   type: string
 *                 modelName:
 *                   type: string
 *                 anomalyThreshold:
 *                   type: number
 *                 timesheetMaxSuggestions:
 *                   type: integer
 *                 supervisorId:
 *                   type: string
 *                   nullable: true
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Configuration not found
 *       500:
 *         description: Server error
 */
router.get(
    '/config',
    [
        check('configID').optional().notEmpty().withMessage('Config ID must not be empty'),
        check('supervisorId').optional().notEmpty().withMessage('Supervisor ID must not be empty')
    ],
    requirePermission('manage_ai_config'),
    AIController.getAIConfig
);

/**
 * @swagger
 * /api/ai/config/{configID}:
 *   delete:
 *     summary: Delete an AI configuration
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: configID
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the AI configuration to delete
 *     responses:
 *       200:
 *         description: AI configuration deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 configID:
 *                   type: string
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Configuration not found
 *       500:
 *         description: Server error
 */
router.delete(
    '/config/:configID',
    [
        check('configID').notEmpty().withMessage('Config ID is required')
    ],
    requirePermission('manage_ai_config'),
    AIController.deleteAIConfig
);

/**
 * @swagger
 * /api/ai/configs:
 *   get:
 *     summary: List all AI configurations
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: supervisorId
 *         schema:
 *           type: string
 *         description: Optional supervisor ID to filter configurations
 *     responses:
 *       200:
 *         description: List of AI configurations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   configID:
 *                     type: string
 *                   modelName:
 *                     type: string
 *                   anomalyThreshold:
 *                     type: number
 *                   timesheetMaxSuggestions:
 *                     type: integer
 *                   supervisorId:
 *                     type: string
 *                     nullable: true
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *       403:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
    '/configs',
    [
        check('supervisorId').optional().notEmpty().withMessage('Supervisor ID must not be empty')
    ],
    requirePermission('manage_ai_config'),
    AIController.listAIConfigs
);

/**
 * @swagger
 * /api/ai/config/{configID}/test:
 *   post:
 *     summary: Test an AI configuration
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: configID
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the AI configuration to test
 *     responses:
 *       200:
 *         description: AI configuration test result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 configID:
 *                   type: string
 *                 status:
 *                   type: string
 *                 response:
 *                   type: object
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Configuration not found
 *       500:
 *         description: Server error
 */
router.post(
    '/config/:configID/test',
    [
        check('configID').notEmpty().withMessage('Config ID is required')
    ],
    requirePermission('manage_ai_config'),
    AIController.testAIConfig
);

module.exports = router;