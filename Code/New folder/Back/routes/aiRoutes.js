const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const AIController = require('../controllers/aiController');

/**
 * @swagger
 * tags:
 *   name: AI Configurations
 *   description: API endpoints for managing AI configurations
 */

/**
 * @swagger
 * /ai/config:
 *   post:
 *     summary: Create a new AI configuration
 *     tags: [AI Configurations]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - modelName
 *               - maxOptimizeRoute
 *               - timesheetMaxSuggestions
 *             properties:
 *               modelName:
 *                 type: string
 *                 description: The name of the AI model
 *               anomalyThreshold:
 *                 type: number
 *                 description: Threshold for anomaly detection (0 to 1, optional)
 *               supervisorId:
 *                 type: string
 *                 description: ID of the supervisor (optional)
 *               maxOptimizeRoute:
 *                 type: integer
 *                 description: Maximum number of route optimizations allowed
 *               timesheetMaxSuggestions:
 *                 type: integer
 *                 description: Maximum number of timesheet suggestions allowed
 *     responses:
 *       201:
 *         description: Created AI configuration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIConfig'
 *       400:
 *         description: Missing required fields or invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/config', requirePermission('manage_ai_config'), AIController.createAIConfig);

/**
 * @swagger
 * /ai/config/{configID}:
 *   put:
 *     summary: Update an AI configuration
 *     tags: [AI Configurations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: configID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the AI configuration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               modelName:
 *                 type: string
 *                 description: The name of the AI model (optional)
 *               anomalyThreshold:
 *                 type: number
 *                 description: Threshold for anomaly detection (0 to 1, optional)
 *               maxOptimizeRoute:
 *                 type: integer
 *                 description: Maximum number of route optimizations allowed (optional)
 *               timesheetMaxSuggestions:
 *                 type: integer
 *                 description: Maximum number of timesheet suggestions allowed (optional)
 *     responses:
 *       200:
 *         description: Updated AI configuration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIConfig'
 *       400:
 *         description: Missing required fields or invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: AI configuration not found
 *       500:
 *         description: Internal server error
 */
router.put('/config/:configID', requirePermission('manage_ai_config'), AIController.updateAIConfig);

/**
 * @swagger
 * /ai/config:
 *   get:
 *     summary: Get an AI configuration
 *     tags: [AI Configurations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: configID
 *         schema:
 *           type: string
 *         description: The ID of the AI configuration (optional)
 *       - in: query
 *         name: supervisorId
 *         schema:
 *           type: string
 *         description: ID of the supervisor (optional)
 *     responses:
 *       200:
 *         description: AI configuration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIConfig'
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: AI configuration not found
 *       500:
 *         description: Internal server error
 */
router.get('/config', requirePermission('manage_ai_config'), AIController.getAIConfig);

/**
 * @swagger
 * /ai/config/{configID}:
 *   delete:
 *     summary: Delete an AI configuration
 *     tags: [AI Configurations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: configID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the AI configuration
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
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: AI configuration not found
 *       500:
 *         description: Internal server error
 */
router.delete('/config/:configID', requirePermission('manage_ai_config'), AIController.deleteAIConfig);

/**
 * @swagger
 * /ai/configs:
 *   get:
 *     summary: List all AI configurations
 *     tags: [AI Configurations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: supervisorId
 *         schema:
 *           type: string
 *         description: ID of the supervisor to filter configurations (optional)
 *     responses:
 *       200:
 *         description: List of AI configurations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AIConfig'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/configs', requirePermission('manage_ai_config'), AIController.listAIConfigs);

/**
 * @swagger
 * /ai/config/{configID}/test:
 *   post:
 *     summary: Test an AI configuration
 *     tags: [AI Configurations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: configID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the AI configuration to test
 *     responses:
 *       200:
 *         description: Test result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 configID:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [success]
 *                 response:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [success]
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: AI configuration not found
 *       500:
 *         description: Internal server error
 */
router.post('/config/:configID/test', requirePermission('manage_ai_config'), AIController.testAIConfig);

module.exports = router;