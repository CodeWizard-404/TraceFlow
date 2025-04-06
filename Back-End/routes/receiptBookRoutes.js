// routes/receiptBookRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateJWT, requirePermission } = require('../config/security');
const ReceiptBookController = require('../controllers/receiptBookController');

// CRUD Routes
router.post('/', authenticateJWT, requirePermission('create_receipt_books'), ReceiptBookController.createReceiptBook);
router.get('/', authenticateJWT, requirePermission('access_all_receipt_books'), ReceiptBookController.getAllReceiptBooks);
router.get('/:bookID', authenticateJWT, requirePermission('access_receipt_book_details'), ReceiptBookController.getReceiptBookById);
router.post('/holder/:holderID', authenticateJWT, requirePermission('access_receipt_books_by_holder'), ReceiptBookController.getReceiptBooksByHolder);
router.get('/number/:number', authenticateJWT, requirePermission('access_receipt_books_by_number'), ReceiptBookController.getReceiptBookByNumber);
router.put('/:bookID', authenticateJWT, requirePermission('update_receipt_books'), ReceiptBookController.updateReceiptBook);
router.delete('/:bookID', authenticateJWT, requirePermission('delete_receipt_books'), ReceiptBookController.deleteReceiptBook);

// Transfer Routes
router.post('/send', authenticateJWT, requirePermission('send_receipt_books'), ReceiptBookController.sendToSupplier);
router.post('/receive', authenticateJWT, requirePermission('collect_supplier_receipt_books'), ReceiptBookController.collectFromSupplier);

router.post('/transfer', authenticateJWT, requirePermission('transfer_receipt_books'), ReceiptBookController.transfer);
router.post('/validate-transfer', authenticateJWT, requirePermission('validate_receipt_books_transfer'), ReceiptBookController.validateTransfer);
router.get('/:bookID/history', authenticateJWT, requirePermission('access_receipt_book_history'), ReceiptBookController.getTransferHistory);






module.exports = router;