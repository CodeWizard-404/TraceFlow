const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const ChecklistController = require('../controllers/checklistController');

/**
 * @swagger
 * tags:
 *   name: Checklists
 *   description: API endpoints for managing checklist items
 */

/**
 * @swagger
 * /checklists:
 *   post:
 *     summary: Create a new checklist item
 *     tags: [Checklists]
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
 *                 description: The content of the checklist item
 *                 example: "Verify equipment status"
 *     responses:
 *       201:
 *         description: Checklist item created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 checklistID:
 *                   type: string
 *                   description: Unique identifier for the checklist item
 *                 item:
 *                   type: string
 *                   description: The content of the checklist item
 *       400:
 *         description: Missing or invalid text
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Checklist text is required"
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
 *                   example: "Permission 'create_checklists_items' required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to create checklist"
 */
router.post('/', requirePermission('create_checklists_items'), ChecklistController.createChecklist);

/**
 * @swagger
 * /checklists/{id}:
 *   get:
 *     summary: Retrieve a checklist item by ID
 *     tags: [Checklists]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the checklist item
 *     responses:
 *       200:
 *         description: Checklist item retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 checklistID:
 *                   type: string
 *                   description: Unique identifier for the checklist item
 *                 item:
 *                   type: string
 *                   description: The content of the checklist item
 *       400:
 *         description: Missing checklist ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Checklist ID is required"
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
 *                   example: "Permission 'access_checklist_item_details' required"
 *       404:
 *         description: Checklist item not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Checklist not found"
 */
router.get('/:id', requirePermission('access_checklist_item_details'), ChecklistController.getChecklistByID);

/**
 * @swagger
 * /checklists/{id}:
 *   put:
 *     summary: Update a checklist item by ID
 *     tags: [Checklists]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the checklist item
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
 *                 description: The updated content of the checklist item
 *                 example: "Verify equipment status updated"
 *     responses:
 *       200:
 *         description: Checklist item updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 checklistID:
 *                   type: string
 *                   description: Unique identifier for the checklist item
 *                 item:
 *                   type: string
 *                   description: The updated content of the checklist item
 *       400:
 *         description: Missing checklist ID or text
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Checklist ID and text are required"
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
 *                   example: "Permission 'update_checklists_items' required"
 *       404:
 *         description: Checklist item not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Checklist not found"
 */
router.put('/:id', requirePermission('update_checklists_items'), ChecklistController.updateChecklist);

/**
 * @swagger
 * /checklists/{id}:
 *   delete:
 *     summary: Delete a checklist item by ID
 *     tags: [Checklists]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the checklist item
 *     responses:
 *       204:
 *         description: Checklist item deleted successfully
 *       400:
 *         description: Missing checklist ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Checklist ID is required"
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
 *                   example: "Permission 'delete_checklists_items' required"
 *       404:
 *         description: Checklist item not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Checklist not found"
 */
router.delete('/:id', requirePermission('delete_checklists_items'), ChecklistController.deleteChecklist);

/**
 * @swagger
 * /checklists:
 *   get:
 *     summary: Retrieve all checklist items
 *     tags: [Checklists]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of all checklist items
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   checklistID:
 *                     type: string
 *                     description: Unique identifier for the checklist item
 *                   item:
 *                     type: string
 *                     description: The content of the checklist item
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
 *                   example: "Permission 'access_checklists_items' required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to retrieve checklists"
 */
router.get('/', requirePermission('access_checklists_items'), ChecklistController.getAllChecklists);

/**
 * @swagger
 * /checklists/visit/{id}:
 *   get:
 *     summary: Retrieve checklist items for a specific visit
 *     tags: [Checklists]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the visit
 *     responses:
 *       200:
 *         description: List of checklist items for the visit
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   checklistID:
 *                     type: string
 *                     description: Unique identifier for the checklist item
 *                   item:
 *                     type: string
 *                     description: The content of the checklist item
 *                   VisitChecklist:
 *                     type: object
 *                     properties:
 *                       checked:
 *                         type: boolean
 *                         description: Indicates if the checklist item is checked for the visit
 *       400:
 *         description: Missing visit ID
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
 *                   example: "Permission 'access_visit_checklist' required"
 *       404:
 *         description: Visit or checklists not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Checklists not found for visit"
 */
router.get('/visit/:id', requirePermission('access_visit_checklist'), ChecklistController.getChecklistsByVisitID);

module.exports = router;