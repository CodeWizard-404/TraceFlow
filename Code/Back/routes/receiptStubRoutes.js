const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const ReceiptStubController = require('../controllers/receiptStubController');

/**
 * @swagger
 * /api/receipt-stubs/collect:
 *   post:
 *     summary: Initiate stub collection for receipt books
 *     description: Initiates the collection process for receipt book stubs by sending an OTP to the assigned agent. Requires 'collect_receipt_stubs' permission.
 *     tags: [Receipt Stubs]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookIDs
 *             properties:
 *               bookIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *                 description: Array of receipt book IDs to collect stubs for
 *     responses:
 *       200:
 *         description: OTP sent to agent for stub collection
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'OTP sent to agent for 2 books'
 *       400:
 *         description: Invalid input (e.g., empty or non-array bookIDs, books not assigned to same agent)
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Some receipt books not found
 *       500:
 *         description: Internal server error
 */
router.post('/collect', requirePermission('collect_receipt_stubs'), ReceiptStubController.collectStub);

/**
 * @swagger
 * /api/receipt-stubs/validate-collection:
 *   post:
 *     summary: Validate stub collection with OTP
 *     description: Validates the stub collection for receipt books using an OTP, updating book and stub statuses. Requires 'validate_receipt_stubs' permission.
 *     tags: [Receipt Stubs]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookIDs
 *               - otpCode
 *             properties:
 *               bookIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *                 description: Array of receipt book IDs to validate collection for
 *               otpCode:
 *                 type: string
 *                 description: OTP code provided by the agent
 *     responses:
 *       200:
 *         description: Stub collection validated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: '2 stubs collected'
 *       400:
 *         description: Invalid input (e.g., empty or non-array bookIDs, missing otpCode, invalid OTP)
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Some receipt books not found
 *       500:
 *         description: Internal server error
 */
router.post('/validate-collection', requirePermission('validate_receipt_stubs'), ReceiptStubController.validateStubCollection);

/**
 * @swagger
 * /api/receipt-stubs/archive:
 *   post:
 *     summary: Archive stubs for receipt books
 *     description: Archives stubs for specified receipt books, updating their status and notifying relevant parties. Requires 'archive_receipt_stubs' permission.
 *     tags: [Receipt Stubs]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookIDs
 *             properties:
 *               bookIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *                 description: Array of receipt book IDs to archive stubs for
 *     responses:
 *       200:
 *         description: Stubs archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: '2 stubs archived'
 *       400:
 *         description: Invalid input (e.g., empty or non-array bookIDs, books not held by stock manager)
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Some receipt books or stubs not found
 *       500:
 *         description: Internal server error
 */
router.post('/archive', requirePermission('archive_receipt_stubs'), ReceiptStubController.archiveStub);

module.exports = router;