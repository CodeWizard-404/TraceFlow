
const express = require('express');
const router = express.Router();
const { authenticateCookie, requirePermission } = require('../config/security');
const SystemController = require('../controllers/systemController');

/**
 * @swagger
 * tags:
 *   name: System
 *   description: API endpoints for managing system logs and logger status
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Log:
 *       type: object
 *       properties:
 *         logID:
 *           type: string
 *           description: Unique identifier for the log entry
 *         level:
 *           type: string
 *           enum: [debug, info, warn, error]
 *           description: Log level
 *         message:
 *           type: string
 *           description: Log message
 *         category:
 *           type: string
 *           description: Category of the log (e.g., auth, system, api)
 *         context:
 *           type: object
 *           description: Additional context for the log
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Time of the log entry
 *       required:
 *         - logID
 *         - level
 *         - message
 *         - timestamp
 *     LogStatistics:
 *       type: object
 *       properties:
 *         totalLogs:
 *           type: integer
 *           description: Total number of logs
 *         byLevel:
 *           type: object
 *           additionalProperties:
 *             type: integer
 *           description: Log counts by level (e.g., debug, info)
 *         byCategory:
 *           type: object
 *           additionalProperties:
 *             type: integer
 *           description: Log counts by category
 *         timeRange:
 *           type: object
 *           properties:
 *             start:
 *               type: string
 *               format: date-time
 *             end:
 *               type: string
 *               format: date-time
 *           description: Time range of the statistics
 *       required:
 *         - totalLogs
 *     LoggerHealth:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [healthy, degraded, unhealthy]
 *           description: Health status of the logger
 *         uptime:
 *           type: number
 *           description: Logger uptime in seconds
 *         lastLogTime:
 *           type: string
 *           format: date-time
 *           description: Timestamp of the last log entry
 *         storageUsage:
 *           type: number
 *           description: Storage usage in bytes
 *       required:
 *         - status
 *         - uptime
 *     LoggerMetrics:
 *       type: object
 *       properties:
 *         logRate:
 *           type: number
 *           description: Logs per second
 *         averageLogSize:
 *           type: number
 *           description: Average size of log entries in bytes
 *         errorRate:
 *           type: number
 *           description: Percentage of error-level logs
 *         topCategories:
 *           type: array
 *           items:
 *             type: string
 *           description: Most frequent log categories
 *       required:
 *         - logRate
 *         - errorRate
 */

/**
 * @swagger
 * /api/system:
 *   get:
 *     summary: Get all system logs
 *     description: Retrieves all system logs with optional filtering by level, date, or context. Results are cached for performance.
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [debug, info, warn, error]
 *         description: Filter logs by level
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for log retrieval
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for log retrieval
 *     responses:
 *       200:
 *         description: List of system logs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Log'
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid date format
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Token required
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Permission 'view_logs' required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Something broke. Try again later.
 */
router.get('/', authenticateCookie, requirePermission('view_logs'), SystemController.getLogs);

/**
 * @swagger
 * /api/system/category/{category}:
 *   get:
 *     summary: Get logs by category
 *     description: Retrieves system logs filtered by a specific category (e.g., auth, system, api). Results are cached for performance.
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *         description: The category of logs to retrieve
 *     responses:
 *       200:
 *         description: List of logs for the specified category
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Log'
 *       400:
 *         description: Missing or invalid category
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid category
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Token required
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Permission 'view_log_categories' required
 *       404:
 *         description: Category not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Category not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Something broke. Try again later.
 */
router.get('/category/:category', authenticateCookie, requirePermission('view_log_categories'), SystemController.getLogsByCategory);

/**
 * @swagger
 * /api/system/delete:
 *   post:
 *     summary: Delete specified logs
 *     description: Deletes logs based on provided filters (e.g., level, date range, category). Triggers a `system: logs_deleted` notification and invalidates cache.
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               logIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Specific log IDs to delete
 *               level:
 *                 type: string
 *                 enum: [debug, info, warn, error]
 *                 description: Delete logs by level
 *               category:
 *                 type: string
 *                 description: Delete logs by category
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Start date for deletion range
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: End date for deletion range
 *             required:
 *               - logIDs
 *     responses:
 *       200:
 *         description: Logs deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logs deleted successfully
 *                 deletedCount:
 *                   type: integer
 *                   description: Number of logs deleted
 *       400:
 *         description: Invalid or missing filters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: At least one filter is required
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Token required
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Permission 'delete_logs' required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Something broke. Try again later.
 */
router.post('/delete', authenticateCookie, requirePermission('delete_logs'), SystemController.deleteLogs);

/**
 * @swagger
 * /api/system/archive:
 *   post:
 *     summary: Archive logs
 *     description: Archives logs based on filters (e.g., level, date range, category). Triggers a `system: logs_archived` notification and invalidates cache.
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               level:
 *                 type: string
 *                 enum: [debug, info, warn, error]
 *                 description: Archive logs by level
 *               category:
 *                 type: string
 *                 description: Archive logs by category
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Start date for archiving range
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: End date for archiving range
 *     responses:
 *       200:
 *         description: Logs archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logs archived successfully
 *                 archiveID:
 *                   type: string
 *                   description: Identifier for the archived logs
 *                 archivedCount:
 *                   type: integer
 *                   description: Number of logs archived
 *       400:
 *         description: Invalid or missing filters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: At least one filter is required
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Token required
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Permission 'archive_logs' required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Something broke. Try again later.
 */
router.post('/archive', authenticateCookie, requirePermission('archive_logs'), SystemController.archiveLogs);

/**
 * @swagger
 * /api/system/statistics:
 *   get:
 *     summary: Get log statistics
 *     description: Retrieves statistics about system logs, such as counts by level, category, and time range. Results are cached for performance.
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for statistics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for statistics
 *     responses:
 *       200:
 *         description: Log statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LogStatistics'
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid date format
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Token required
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Permission 'view_log_statistics' required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Something broke. Try again later.
 */
router.get('/statistics', authenticateCookie, requirePermission('view_log_statistics'), SystemController.getLogStatistics);

/**
 * @swagger
 * /api/system/export:
 *   get:
 *     summary: Export system logs
 *     description: Exports system logs in a downloadable format (e.g., CSV, JSON) based on filters. Results are not cached due to export nature.
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *         description: Export format
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [debug, info, warn, error]
 *         description: Filter logs by level
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for export
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for export
 *     responses:
 *       200:
 *         description: Logs exported successfully
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid format
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Token required
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Permission 'export_logs' required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Something broke. Try again later.
 */
router.get('/export', authenticateCookie, requirePermission('export_logs'), SystemController.exportLogs);

/**
 * @swagger
 * /api/system/clear:
 *   post:
 *     summary: Clear all system logs
 *     description: Deletes all system logs. Triggers a `system: logs_cleared` notification and invalidates cache.
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: All logs cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: All logs cleared successfully
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Token required
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Permission 'clear_logs' required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Something broke. Try again later.
 */
router.post('/clear', authenticateCookie, requirePermission('clear_logs'), SystemController.clearAllLogs);

/**
 * @swagger
 * /api/system/unique/{field}:
 *   get:
 *     summary: Get unique values for a log field
 *     description: Retrieves unique values for a specified log field (e.g., category, level). Results are cached for performance.
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: field
 *         required: true
 *         schema:
 *           type: string
 *           enum: [category, level]
 *         description: The log field to retrieve unique values for
 *     responses:
 *       200:
 *         description: List of unique values
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       400:
 *         description: Invalid or unsupported field
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Unsupported field
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Token required
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Permission 'view_log_filters' required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Something broke. Try again later.
 */
router.get('/unique/:field', authenticateCookie, requirePermission('view_log_filters'), SystemController.getUniqueValues);

/**
 * @swagger
 * /api/system/health:
 *   get:
 *     summary: Check logger health
 *     description: Retrieves the health status of the logging system. Results are cached for performance.
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logger health status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoggerHealth'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Token required
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Permission 'view_logger_health' required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Something broke. Try again later.
 */
router.get('/health', authenticateCookie, requirePermission('view_logger_health'), SystemController.getLoggerHealth);

/**
 * @swagger
 * /api/system/metrics:
 *   get:
 *     summary: Get logger metrics
 *     description: Retrieves performance metrics for the logging system, such as log rate and error rate. Results are cached for performance.
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logger metrics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoggerMetrics'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Token required
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Permission 'view_logger_metrics' required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Something broke. Try again later.
 */
router.get('/metrics', authenticateCookie, requirePermission('view_logger_metrics'), SystemController.getLoggerMetrics);

module.exports = router;
