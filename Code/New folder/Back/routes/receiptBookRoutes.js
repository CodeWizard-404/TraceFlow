const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const ReceiptBookController = require('../controllers/receiptBookController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * /api/receipt-books/types:
 *   post:
 *     summary: Create a new receipt book type
 *     description: Creates a new receipt book type with the specified name. Requires 'manage_receipt_book_types' permission.
 *     tags: [Receipt Book Types]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 * description: Name of the receipt book type
 *               example: Standard Receipt
 *     responses:
 *       201:
 *         description: Receipt book type created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 typeID: number
 *                 name: string
 *               example:
 *                 typeID: 1
 *                 name: Standard Receipt
 *       400:
 *         description: Missing required field 'name' or duplicate name
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       500:
 *         description: Internal server error
 */
router.post('/types', requirePermission('manage_receipt_book_types'), ReceiptBookController.createReceiptBookType);

/**
 * @swagger
 * /api/receipt-books/types:
 *   get:
 *     summary: Get all receipt book types
 *     description: Retrieves a list of all receipt book types. Requires 'access_receipt_book_types' permission.
 *     tags: [Receipt Book Types]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of receipt book types
 *         description:
 *           content:
 *             application/json:
 *               schema:
 *                 type: array
 *                 items:
 *                   type: object
 *                 properties:
 *                   typeID: *                     number
                    name:
                      type: string
 *                   example:
 *                     - typeID: 1
 *                     name: Standard Receipt
 *                     - typeID: 2
 *                     name: Premium Receipt
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       500:
 *         description: Internal server error
 */
router.get('/types', requirePermission('access_receipt_book_types'), ReceiptBookController.getAllReceiptBookTypes);

/**
 * @swagger
 * /api/receipt-books/types/{typeID}:
 *   get:
 *     summary: Get a receipt book type by ID
 *     description: Retrieves a specific receipt book type by its ID. Requires 'access_receipt_book_types' permission.
 *     tags: [Receipt Book Types]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: typeID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the receipt book type
 *     responses:
 *       200:
 *         description: Receipt book type details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 typeID:
 * number
 *                 name:
 *                 type: string
 *               example:
 *                 typeID: 1
 *                 name: Standard Receipt
 *       400:
 *         description: Missing required field 'typeID'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Receipt book type not found
 *       500:
 *         description: Internal server error
 */
router.get('/types/:typeID', requirePermission('access_receipt_book_types'), ReceiptBookController.getReceiptBookTypeById);

/**
 * @swagger
 * /api/receipt-books/types/{typeID}:
 *   put:
 *     summary: Update a receipt book type
 *     description: Updates an existing receipt book type with a new name. Requires 'manage_receipt_book_types' permission.
 *     tags: [Receipt Book Types]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: typeID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the receipt book type
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: New name for the receipt book type
 *               example:
 *                 name: Updated Standard Receipt
 *     responses:
 *       200:
 *         description: Receipt book type updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 typeID:
 * number
 *                 name:
 *                 type: string
 *               example:
 *                 typeID: 1
 *                 name: Updated Standard Receipt
 *       400:
 *         description: Missing required fields 'typeID' or 'name' or duplicate name
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Receipt book type not found
 *       500:
 *         description: Internal server error
 */
router.put('/types/:typeID', requirePermission('manage_receipt_book_types'), ReceiptBookController.updateReceiptBookType);

/**
 * @swagger
 * /api/receipt-books/types/{typeID}:
 *   delete:
 *     summary: Delete a receipt book type
 *     description: Deletes a receipt book type if it has no associated receipt books. Requires 'manage_receipt_book_types' permission.
 *     tags: [Receipt Book Types]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: typeID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the receipt book type
 *     responses:
 *       200:
 *         description: Receipt book type deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Receipt book type Standard Receipt deleted successfully
 *       400:
 *         description: Missing required field 'typeID' or type has associated receipt books
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Receipt book type not found
 *       500:
 *         description: Internal server error
 */
router.delete('/types/:typeID', requirePermission('manage_receipt_book_types'), ReceiptBookController.deleteReceiptBookType);

/**
 * @swagger
 * /api/receipt-books/holders:
 *   get:
 *     summary: Get all receipt book holders
 *     description: Retrieves a list of users who currently hold receipt books, including their roles. Requires 'access_receipt_book_holders' permission.
 *     tags: [Receipt Books]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of receipt book holders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   userID:
 *                     type: string
 *                   firstname:
 *                     type: string
 *                   lastname:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   Roles:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         roleID:
 *                           type: number
 *                         name:
 *                           type: string
 *               example:
 *                 - userID: uuid-123
 *                   firstname: John
 *                   lastname: Doe
 *                   phone: +1234567890
 *                   Roles:
 *                     - roleID: 1
 *                       name: Regional Manager
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       500:
 *         description: Internal server error
 */
router.get('/holders', requirePermission('access_receipt_book_holders'), ReceiptBookController.getReceiptBookHolders);

/**
 * @swagger
 * /api/receipt-books:
 *   post:
 *     summary: Create a new receipt book
 *     description: Creates a new receipt book with the specified number and type. Requires 'create_receipt_books' permission.
 *     tags: [Receipt Books]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - number
 *               - typeID
 *             properties:
 *               number:
 *                 type: string
 *                 description: Unique receipt book number (1-50 alphanumeric characters)
 *               typeID:
 *                 type: string
 *                 description: ID of the receipt book type
 *               example:
 *                 number: RB123
 *                 typeID: 1
 *     responses:
 *       201:
 *         description: Receipt book created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bookID:
 *                   type: string
 *                 number:
 *                   type: string
 *                 status:
 *                   type: string
 *                 qrCode:
 *                   type: string
 *                 agentID:
 *                   type: string
 *                 currentHolderID:
 *                   type: string
 *                 type:
 *                   type: string
 *               example:
 *                 bookID: uuid-456
 *                 number: RB123
 *                 status: In Stock
 *                 qrCode: base64-encoded-string
 *                 agentID: null
 *                 currentHolderID: uuid-123
 *                 type: Standard Receipt
 *       400:
 *         description: Missing required fields, invalid number format, or invalid typeID
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       500:
 *         description: Internal server error
 */
router.post('/', requirePermission('create_receipt_books'), ReceiptBookController.createReceiptBook);

/**
 * @swagger
 * /api/receipt-books:
 *   get:
 *     summary: Get all receipt books
 *     description: Retrieves a paginated list of receipt books with optional filtering and sorting. Requires 'access_all_receipt_books' permission.
 *     tags: [Receipt Books]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - name: sortField
 *         in: query
 *         schema:
 *           type: string
 *           default: number
 *           enum: [number, holder, bookStatus, stubStatus, type]
 *         description: Field to sort by
 *       - name: sortOrder
 *         in: query
 *         schema:
 *           type: string
 *           default: ASC
 *           enum: [ASC, DESC]
 *         description: Sort order
 *       - name: searchQuery
 *         in: query
 *         schema:
 *           type: string
 *           default: ''
 *         description: Search query for book number, type, status, holder, or agent
 *       - name: filterType
 *         in: query
 *         schema:
 *           type: string
 *           default: all
 *         description: Filter by receipt book type ID
 *       - name: filterStatus
 *         in: query
 *         schema:
 *           type: string
 *           default: all
 *         description: Filter by book status
 *     responses:
 *       200:
 *         description: List of receipt books
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 books:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       bookID:
 *                         type: string
 *                       number:
 *                         type: string
 *                       status:
 *                         type: string
 *                       qrCode:
 *                         type: string
 *                       agentID:
 *                         type: string
 *                       currentHolderID:
 *                         type: string
 *                       typeID:
 *                         type: string
 *                       holder:
 *                         type: object
 *                       Agent:
 *                         type: object
 *                       type:
 *                         type: string
 *                       ReceiptStub:
 *                         type: object
 *                 totalCount:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *               example:
 *                 books:
 *                   - bookID: uuid-456
 *                     number: RB123
 *                     status: In Stock
 *                     qrCode: base64-encoded-string
 *                     agentID: null
 *                     currentHolderID: uuid-123
 *                     typeID: 1
 *                     holder:
 *                       userID: uuid-123
 *                       firstname: John
 *                       lastname: Doe
 *                       phone: +1234567890
 *                     Agent: null
 *                     type: Standard Receipt
 *                     ReceiptStub:
 *                       stubID: uuid-789
 *                       status: pending
 *                 totalCount: 50
 *                 currentPage: 1
 *                 totalPages: 5
 *       400:
 *         description: Invalid sortField or sortOrder
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       500:
 *         description: Internal server error
 */
router.get('/', requirePermission('access_all_receipt_books'), ReceiptBookController.getAllReceiptBooks);

/**
 * @swagger
 * /api/receipt-books/{bookID}:
 *   get:
 *     summary: Get a receipt book by ID
 *     description: Retrieves details of a specific receipt book by its ID. Requires 'access_receipt_book_details' permission.
 *     tags: [Receipt Books]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: bookID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the receipt book
 *     responses:
 *       200:
 *         description: Receipt book details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bookID:
 *                   type: string
 *                 number:
 *                   type: string
 *                 status:
 *                   type: string
 *                 qrCode:
 *                   type: string
 *                 agentID:
 *                   type: string
 *                 currentHolderID:
 *                   type: string
 *                 typeID:
 *                   type: string
 *                 holder:
 *                   type: object
 *                 ReceiptBookTransfers:
 *                   type: array
 *                 Agent:
 *                   type: object
 *                 ReceiptStub:
 *                   type: object
 *                 type:
 *                   type: string
 *               example:
 *                 bookID: uuid-456
 *                 number: RB123
 *                 status: In Stock
 *                 qrCode: base64-encoded-string
 *                 agentID: null
 *                 currentHolderID: uuid-123
 *                 typeID: 1
 *                 holder:
 *                   userID: uuid-123
 *                   firstname: John
 *                   lastname: Doe
 *                   phone: +1234567890
 *                 ReceiptBookTransfers: []
 *                 Agent: null
 *                 ReceiptStub:
 *                   stubID: uuid-789
 *                   status: pending
 *                 type: Standard Receipt
 *       400:
 *         description: Missing required field 'bookID'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Receipt book not found
 *       500:
 *         description: Internal server error
 */
router.get('/:bookID', requirePermission('access_receipt_book_details'), ReceiptBookController.getReceiptBookById);

/**
 * @swagger
 * /api/receipt-books/holder/{holderID}:
 *   post:
 *     summary: Get receipt books by holder
 *     description: Retrieves receipt books held by a specific user or agent. Requires 'access_receipt_books_by_holder' permission.
 *     tags: [Receipt Books]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: holderID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the holder (user or agent)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userType
 *             properties:
 *               userType:
 *                 type: string
 *                 enum: [user, agent]
 *                 description: Type of the holder
 *               example:
 *                 userType: user
 *     responses:
 *       200:
 *         description: List of receipt books
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   bookID:
 *                     type: string
 *                   number:
 *                     type: string
 *                   status:
 *                     type: string
 *                   qrCode:
 *                     type: string
 *                   agentID:
 *                     type: string
 *                   currentHolderID:
 *                     type: string
 *                   typeID:
 *                     type: string
 *                   holder:
 *                     type: object
 *                   ReceiptBookTransfers:
 *                     type: array
 *                   Agent:
 *                     type: object
 *                   ReceiptStub:
 *                     type: object
 *                   type:
 *                     type: string
 *               example:
 *                 - bookID: uuid-456
 *                   number: RB123
 *                   status: In Stock
 *                   qrCode: base64-encoded-string
 *                   agentID: null
 *                   currentHolderID: uuid-123
 *                   typeID: 1
 *                   holder:
 *                     userID: uuid-123
 *                     firstname: John
 *                     lastname: Doe
 *                     phone: +1234567890
 *                   ReceiptBookTransfers: []
 *                   Agent: null
 *                   ReceiptStub:
 *                     stubID: uuid-789
 *                     status: pending
 *                   type: Standard Receipt
 *       400:
 *         description: Missing required fields 'holderID' or 'userType'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Holder not found
 *       500:
 *         description: Internal server error
 */
router.post('/holder/:holderID', requirePermission('access_receipt_books_by_holder'), ReceiptBookController.getReceiptBooksByHolder);

/**
 * @swagger
 * /api/receipt-books/number/{number}:
 *   get:
 *     summary: Get a receipt book by number
 *     description: Retrieves details of a specific receipt book by its number. Requires 'access_receipt_books_by_number' permission.
 *     tags: [Receipt Books]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: number
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Number of the receipt book
 *     responses:
 *       200:
 *         description: Receipt book details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bookID:
 *                   type: string
 *                 number:
 *                   type: string
 *                 status:
 *                   type: string
 *                 qrCode:
 *                   type: string
 *                 agentID:
 *                   type: string
 *                 currentHolderID:
 *                   type: string
 *                 typeID:
 *                   type: string
 *                 holder:
 *                   type: object
 *                 ReceiptBookTransfers:
 *                   type: array
 *                 Agent:
 *                   type: object
 *                 ReceiptStub:
 *                   type: object
 *                 type:
 *                   type: string
 *               example:
 *                 bookID: uuid-456
 *                 number: RB123
 *                 status: In Stock
 *                 qrCode: base64-encoded-string
 *                 agentID: null
 *                 currentHolderID: uuid-123
 *                 typeID: 1
 *                 holder:
 *                   userID: uuid-123
 *                   firstname: John
 *                   lastname: Doe
 *                   phone: +1234567890
 *                 ReceiptBookTransfers: []
 *                 Agent: null
 *                 ReceiptStub:
 *                   stubID: uuid-789
 *                   status: pending
 *                 type: Standard Receipt
 *       400:
 *         description: Missing required field 'number'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Receipt book not found
 *       500:
 *         description: Internal server error
 */
router.get('/number/:number', requirePermission('access_receipt_books_by_number'), ReceiptBookController.getReceiptBookByNumber);

/**
 * @swagger
 * /api/receipt-books/{bookID}:
 *   put:
 *     summary: Update a receipt book
 *     description: Updates a receipt book’s number or type, restricted to the current holder. Requires 'update_receipt_books' permission.
 *     tags: [Receipt Books]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: bookID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the receipt book
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               number:
 *                 type: string
 *                 description: New receipt book number (1-50 alphanumeric characters)
 *               typeID:
 *                 type: string
 *                 description: New receipt book type ID
 *               example:
 *                 number: RB124
 *                 typeID: 2
 *     responses:
 *       200:
 *         description: Receipt book updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bookID:
 *                   type: string
 *                 number:
 *                   type: string
 *                 status:
 *                   type: string
 *                 qrCode:
 *                   type: string
 *                 agentID:
 *                   type: string
 *                 currentHolderID:
 *                   type: string
 *                 type:
 *                   type: string
 *                 CurrentHolder:
 *                   type: object
 *                 ReceiptBookTransfers:
 *                   type: array
 *                 Agent:
 *                   type: object
 *                 ReceiptStub:
 *                   type: object
 *               example:
 *                 bookID: uuid-456
 *                 number: RB124
 *                 status: In Stock
 *                 qrCode: base64-encoded-string
 *                 agentID: null
 *                 currentHolderID: uuid-123
 *                 type: Premium Receipt
 *                 CurrentHolder:
 *                   userID: uuid-123
 *                   firstname: John
 *                   lastname: Doe
 *                   phone: +1234567890
 *                 ReceiptBookTransfers: []
 *                 Agent: null
 *                 ReceiptStub:
 *                   stubID: uuid-789
 *                   status: pending
 *       400:
 *         description: Missing required field 'bookID', invalid number format, or invalid typeID
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions or not current holder)
 *       404:
 *         description: Receipt book not found
 *       500:
 *         description: Internal server error
 */
router.put('/:bookID', requirePermission('update_receipt_books'), ReceiptBookController.updateReceiptBook);

/**
 * @swagger
 * /api/receipt-books/{bookID}:
 *   delete:
 *     summary: Delete a receipt book
 *     description: Deletes a receipt book if it is in 'In Stock' or 'With Stock Manager' status. Requires 'delete_receipt_books' permission.
 *     tags: [Receipt Books]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: bookID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the receipt book
 *     responses:
 *       200:
 *         description: Receipt book deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Receipt Book #RB123 deleted successfully
 *       400:
 *         description: Missing required field 'bookID' or invalid book status
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Receipt book not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:bookID', requirePermission('delete_receipt_books'), ReceiptBookController.deleteReceiptBook);

/**
 * @swagger
 * /api/receipt-books/upload-csv:
 *   post:
 *     summary: Upload receipt books via CSV
 *     description: Processes a CSV file to create receipt books, validating number and type. Requires 'create_receipt_books' permission.
 *     tags: [Receipt Books]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               csvFile:
 *                 type: string
 *                 format: binary
 *                 description: CSV file containing receipt book data (columns: number, type)
 *     responses:
 *       200:
 *         description: CSV processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [completed_successfully, completed_with_issues, failed]
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalRecords:
 *                       type: integer
 *                     booksCreated:
 *                       type: integer
 *                     recordsSkipped:
 *                       type: integer
 *                     errorsEncountered:
 *                       type: integer
 *                 detailedLog:
 *                   type: object
 *                   properties:
 *                     created:
 *                       type: array
 *                       items:
 *                         type: object
 *                     skipped:
 *                       type: array
 *                       items:
 *                         type: object
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *               example:
 *                 status: completed_with_issues
 *                 summary:
 *                   totalRecords: 10
 *                   booksCreated: 8
 *                   recordsSkipped: 1
 *                   errorsEncountered: 1
 *                 detailedLog:
 *                   created: [{ bookNumber: RB123, bookType: Standard Receipt, timestamp: 2025-06-15T18:00:00Z, details: Receipt book created }]
 *                   skipped: [{ bookNumber: RB124, bookType: Standard Receipt, timestamp: 2025-06-15T18:00:00Z, reason: Duplicate number }]
 *                   errors: [{ bookNumber: RB125, bookType: Invalid Type, timestamp: 2025-06-15T18:00:00Z, reason: Invalid book type }]
 *       400:
 *         description: Missing CSV file, invalid headers, or encoding issues
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       500:
 *         description: Internal server error
 */
router.post('/upload-csv',
    requirePermission('create_receipt_books'),
    upload.single('csvFile'),
    ReceiptBookController.uploadReceiptBooksCSV
);

/**
 * @swagger
 * /api/receipt-books/send:
 *   post:
 *     summary: Send receipt books to supplier
 *     description: Sends receipt books to a supplier for printing, generating CSV and QR code ZIP files. Requires 'send_receipt_books' permission.
 *     tags: [Receipt Book Transfers]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transferID
 *               - supplierEmail
 *             properties:
 *               transferID:
 *                 type: string
 *                 description: Unique transfer ID
 *               bookIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of receipt book IDs (required if isPartial is true)
 *               supplierEmail:
 *                 type: string
 *                 description: Email address of the supplier
 *               isPartial:
 *                 type: boolean
 *                 description: Indicates if this is a partial transfer
 *               example:
 *                 transferID: uuid-789
 *                 bookIDs: [uuid-456, uuid-457]
 *                 supplierEmail: supplier@example.com
 *                 isPartial: true
 *     responses:
 *       200:
 *         description: Books sent to supplier
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 csvUrl:
 *                   type: string
 *                 zipUrl:
 *                   type: string
 *               example:
 *                 message: 2 books sent to supplier
 *                 csvUrl: http://localhost:5000/api/uploads/supplier_files/uuid-789_books.csv?token=token-123
 *                 zipUrl: http://localhost:5000/api/uploads/supplier_files/uuid-789_qrcodes.zip?token=token-456
 *       400:
 *         description: Missing required fields, invalid book status, or invalid transferID
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Some books not found
 *       500:
 *         description: Internal server error
 */
router.post('/send', requirePermission('send_receipt_books'), ReceiptBookController.sendToSupplier);

/**
 * @swagger
 * /api/receipt-books/receive:
 *   post:
 *     summary: Collect receipt books from supplier
 *     description: Collects receipt books from a supplier, updating their status. Requires 'collect_supplier_receipt_books' permission.
 *     tags: [Receipt Book Transfers]
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
 *               - userID
 *             properties:
 *               bookIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of receipt book IDs
 *               userID:
 *                 type: string
 *                 description: ID of the user collecting the books
 *               example:
 *                 bookIDs: [uuid-456, uuid-457]
 *                 userID: uuid-123
 *     responses:
 *       200:
 *         description: Books collected from supplier
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 2 books collected from supplier
 *       400:
 *         description: Missing required fields or invalid book status
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions or user not in Purchase Team/Super Admin)
 *       404:
 *         description: Some books or user not found
 *       500:
 *         description: Internal server error
 */
router.post('/receive', requirePermission('collect_supplier_receipt_books'), ReceiptBookController.collectFromSupplier);

/**
 * @swagger
 * /api/receipt-books/transfer:
 *   post:
 *     summary: Initiate a receipt book transfer
 *     description: Initiates a transfer of receipt books to a user or agent, sending an OTP. Requires 'transfer_receipt_books' permission.
 *     tags: [Receipt Book Transfers]
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
 *               - recipientID
 *             properties:
 *               bookIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of receipt book IDs
 *               recipientID:
 *                 type: string
 *                 description: ID of the recipient (user or agent)
 *               recipientType:
 *                 type: string
 *                 enum: [user, agent]
 *                 default: user
 *                 description: Type of the recipient
 *               example:
 *                 bookIDs: [uuid-456, uuid-457]
 *                 recipientID: uuid-123
 *                 recipientType: user
 *     responses:
 *       200:
 *         description: Transfer initiated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 otpID:
 *                   type: string
 *               example:
 *                 message: Transfer initiated for 2 books to user uuid-123
 *                 otpID: uuid-789
 *       400:
 *         description: Missing required fields or invalid transfer conditions
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Some books or recipient not found
 *       500:
 *         description: Internal server error
 */
router.post('/transfer', requirePermission('transfer_receipt_books'), ReceiptBookController.transfer);

/**
 * @swagger
 * /api/receipt-books/validate-transfer:
 *   post:
 *     summary: Validate a receipt book transfer
 *     description: Validates a transfer of receipt books using an OTP, updating their status. Requires 'validate_receipt_books_transfer' permission.
 *     tags: [Receipt Book Transfers]
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
 *               - recipientID
 *               - otpCode
 *             properties:
 *               bookIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of receipt book IDs
 *               recipientID:
 *                 type: string
 *                 description: ID of the recipient
 *               otpCode:
 *                 type: string
 *                 description: OTP code for validation
 *               recipientType:
 *                 type: string
 *                 enum: [user, agent]
 *                 default: user
 *                 description: Type of the recipient
 *               example:
 *                 bookIDs: [uuid-456, uuid-457]
 *                 recipientID: uuid-123
 *                 otpCode: 123456
 *                 recipientType: user
 *     responses:
 *       200:
 *         description: Transfer validated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 2 receipt books transferred and validated
 *       400:
 *         description: Missing required fields, invalid OTP, or no pending transfer
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Some books or recipient not found
 *       500:
 *         description: Internal server error
 */
router.post('/validate-transfer', requirePermission('validate_receipt_books_transfer'), ReceiptBookController.validateTransfer);

/**
 * @swagger
 * /api/receipt-books/{bookID}/history:
 *   get:
 *     summary: Get transfer history of a receipt book
 *     description: Retrieves the transfer history of a specific receipt book. Requires 'access_receipt_book_history' permission.
 *     tags: [Receipt Book Transfers]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: bookID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the receipt book
 *     responses:
 *       200:
 *         description: Transfer history
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   transferID:
 *                     type: string
 *                   bookID:
 *                     type: string
 *                   fromUserID:
 *                     type: string
 *                   toUserID:
 *                     type: string
 *                   toAgentID:
 *                     type: string
 *                   transferType:
 *                     type: string
 *                   status:
 *                     type: string
 *                   transferDate:
 *                     type: string
 *                   FromUser:
 *                     type: object
 *                   ToUser:
 *                     type: object
 *                   Agent:
 *                     type: object
 *               example:
 *                 - transferID: uuid-789
 *                   bookID: uuid-456
 *                   fromUserID: uuid-123
 *                   toUserID: null
 *                   toAgentID: null
 *                   transferType: ToSupplier
 *                   status: Validated
 *                   transferDate: 2025-06-15T18:00:00Z
 *                   FromUser:
 *                     userID: uuid-123
 *                     firstname: John
 *                     lastname: Doe
 *                   ToUser: null
 *                   Agent: null
 *       400:
 *         description: Missing required field 'bookID'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Receipt book not found
 *       500:
 *         description: Internal server error
 */
router.get('/:bookID/history', requirePermission('access_receipt_book_history'), ReceiptBookController.getTransferHistory);

module.exports = router;