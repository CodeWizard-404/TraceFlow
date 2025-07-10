const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const ReasonController = require('../controllers/reasonController');

/**
 * @swagger
 * tags:
 *   name: Reasons
 *   description: API endpoints for managing reasons
 */

/**
 * @swagger
 * /reasons:
 *   post:
 *     summary: Create a new reason
 *     tags: [Reasons]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: The text content of the reason
 *                 example: "Missed appointment"
 *     responses:
 *       201:
 *         description: Reason created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reasonID:
 *                   type: string
 *                   description: Unique identifier for the reason
 *                 item:
 *                   type: string
 *                   description: The text content of the reason
 *       400:
 *         description: Reason text is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Reason text is required"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'create_reason_items' required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to create reason"
 */
router.post('/', requirePermission('create_reason_items'), ReasonController.createReason);

/**
 * @swagger
 * /reasons/{id}:
 *   get:
 *     summary: Retrieve a reason by ID
 *     tags: [Reasons]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the reason to retrieve
 *     responses:
 *       200:
 *         description: Reason retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reasonID:
 *                   type: string
 *                   description: Unique identifier for the reason
 *                 item:
 *                   type: string
 *                   description: The text content of the reason
 *       400:
 *         description: Reason ID is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Reason ID is required"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'access_reason_item_details' required"
 *       404:
 *         description: Reason not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Reason not found"
 */
router.get('/:id', requirePermission('access_reason_item_details'), ReasonController.getReasonByID);

/**
 * @swagger
 * /reasons/{id}:
 *   put:
 *     summary: Update a reason by ID
 *     tags: [Reasons]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the reason to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: The updated text content of the reason
 *                 example: "Updated missed appointment"
 *     responses:
 *       200:
 *         description: Reason updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reasonID:
 *                   type: string
 *                   description: Unique identifier for the reason
 *                 item:
 *                   type: string
 *                   description: The updated text content of the reason
 *       400:
 *         description: Reason ID and text are required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Reason ID and text are required"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'update_reason_items' required"
 *       404:
 *         description: Reason not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to update reason"
 */
router.put('/:id', requirePermission('update_reason_items'), ReasonController.updateReason);

/**
 * @swagger
 * /reasons/{id}:
 *   delete:
 *     summary: Delete a reason by ID
 *     tags: [Reasons]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the reason to delete
 *     responses:
 *       204:
 *         description: Reason deleted successfully
 *       400:
 *         description: Reason ID is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Reason ID is required"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'delete_reason_items' required"
 *       404:
 *         description: Reason not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to delete reason"
 */
router.delete('/:id', requirePermission('delete_reason_items'), ReasonController.deleteReason);

/**
 * @swagger
 * /reasons:
 *   get:
 *     summary: Retrieve all reasons
 *     tags: [Reasons]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of all reasons
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   reasonID:
 *                     type: string
 *                     description: Unique identifier for the reason
 *                   item:
 *                     type: string
 *                     description: The text content of the reason
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'access_reason_items' required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to retrieve reasons"
 */
router.get('/', requirePermission('access_reason_items'), ReasonController.getAllReasons);

/**
 * @swagger
 * /reasons/visit/{id}:
 *   get:
 *     summary: Retrieve reasons associated with a visit by visit ID
 *     tags: [Reasons]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the visit to retrieve reasons for
 *     responses:
 *       200:
 *         description: List of reasons for the specified visit
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   reasonID:
 *                     type: string
 *                     description: Unique identifier for the reason
 *                   item:
 *                     type: string
 *                     description: The text content of the reason
 *       400:
 *         description: Visit ID is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Visit ID is required"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'access_visit_reasons' required"
 *       404:
 *         description: Visit or reasons not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Reasons not found for visit"
 */
router.get('/visit/:id', requirePermission('access_visit_reasons'), ReasonController.getReasonsByVisitID);

module.exports = router;