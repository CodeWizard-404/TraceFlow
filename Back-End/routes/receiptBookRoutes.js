const express = require('express');
const router = express.Router();
const ReceiptBookController = require('../controllers/receiptBookController');
const { authenticateJWT, restrictTo } = require('../config/security');

router.post('/', authenticateJWT, restrictTo('Purchase'), ReceiptBookController.createReceiptBook);
router.get('/', authenticateJWT, restrictTo('Purchase', 'Regional Manager', 'Supervisor'), ReceiptBookController.getAllReceiptBooks);
router.get('/:bookID', authenticateJWT, restrictTo('Purchase', 'Regional Manager', 'Supervisor'), ReceiptBookController.getReceiptBookById);
router.put('/:bookID', authenticateJWT, restrictTo('Purchase'), ReceiptBookController.updateReceiptBook);
router.delete('/:bookID', authenticateJWT, restrictTo('Purchase'), ReceiptBookController.deleteReceiptBook);
router.post('/send-qr', authenticateJWT, restrictTo('Purchase'), ReceiptBookController.sendQRCodeToSupplier);
router.post('/transfer', authenticateJWT, restrictTo('Regional Manager', 'Supervisor'), ReceiptBookController.transferReceiptBookToUser);
router.post('/validate-transfer', authenticateJWT, restrictTo('Regional Manager', 'Supervisor'), ReceiptBookController.validateTransferToUser);
router.post('/assign-agent', authenticateJWT, restrictTo('Supervisor'), ReceiptBookController.assignToAgent);
router.post('/validate-agent', authenticateJWT, restrictTo('Supervisor'), ReceiptBookController.validateAgentAssignment);

module.exports = router;