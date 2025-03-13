const express = require('express');
const router = express.Router();
const { authenticateJWT, requirePermission } = require('../config/security');
const ReceiptBookController = require('../controllers/receiptBookController');


router.post('/send', authenticateJWT, requirePermission('send_receipt_books'),  ReceiptBookController.sendToSupplier);

router.post('/transfer', authenticateJWT, requirePermission('transfer_receipt_books'),  ReceiptBookController.transferReceiptBookToUser);
router.post('/validate-transfer', authenticateJWT , requirePermission('validate_receipt_books'), ReceiptBookController.validateTransferToUser);

router.post('/assign-agent', authenticateJWT, requirePermission('assign_receipt_books'), ReceiptBookController.assignToAgent);
router.post('/validate-agent', authenticateJWT, requirePermission('validate_receipt_books'), ReceiptBookController.validateAgentAssignment);

router.get('/:bookID/history', authenticateJWT, requirePermission('access_receipt_book_history'), ReceiptBookController.getTransferHistory);

router.post('/', authenticateJWT, requirePermission('create_receipt_books'), ReceiptBookController.createReceiptBook);
router.get('/', authenticateJWT, requirePermission('access_receipt_books'), ReceiptBookController.getAllReceiptBooks);
router.get('/:bookID', authenticateJWT, requirePermission('access_receipt_book_details'), ReceiptBookController.getReceiptBookById);
router.put('/:bookID', authenticateJWT, requirePermission('update_receipt_books'),  ReceiptBookController.updateReceiptBook);
router.delete('/:bookID', authenticateJWT, requirePermission('delete_receipt_books'),  ReceiptBookController.deleteReceiptBook);

module.exports = router;