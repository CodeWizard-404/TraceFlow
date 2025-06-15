const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const CsvHeaderController = require('../controllers/csvHeaderController');

/**
 * @swagger
 * tags:
 *   name: CSV Headers
 *   description: API endpoints for managing CSV header mappings
 */

/**
 * @swagger
 * /csv-headers:
 *   get:
 *     summary: Retrieve CSV header mappings for a given CSV type
 *     tags: [CSV Headers]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: csvType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [agent, receipt_book]
 *         description: The type of CSV (e.g., 'agent', 'receipt_book')
 *     responses:
 *       200:
 *         description: List of CSV header mappings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 headers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       headerID:
 *                         type: string
 *                         description: Unique identifier for the header
 *                       csvType:
 *                         type: string
 *                         description: Type of CSV
 *                       expectedHeader:
 *                         type: string
 *                         description: Expected header name
 *                       mappedHeader:
 *                         type: string
 *                         description: Mapped header name
 *       400:
 *         description: Missing or invalid csvType
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "csvType is required"
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
 *                   example: "Permission 'view_csv_headers' required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get('/', requirePermission('view_csv_headers'), CsvHeaderController.getHeaders);

/**
 * @swagger
 * /csv-headers:
 *   put:
 *     summary: Update or create CSV header mappings for a given CSV type
 *     tags: [CSV Headers]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - csvType
 *               - headers
 *             properties:
 *               csvType:
 *                 type: string
 *                 enum: [agent, receipt_book]
 *                 description: The type of CSV (e.g., 'agent', 'receipt_book')
 *               headers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - expectedHeader
 *                     - mappedHeader
 *                   properties:
 *                     expectedHeader:
 *                       type: string
 *                       description: Expected header name
 *                     mappedHeader:
 *                       type: string
 *                       description: Mapped header name
 *     responses:
 *       200:
 *         description: Headers updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Headers updated successfully"
 *       400:
 *         description: Missing or invalid request fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "csvType and headers array are required"
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
 *                   example: "Permission 'update_csv_headers' required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.put('/', requirePermission('update_csv_headers'), CsvHeaderController.updateHeaders);

module.exports = router;