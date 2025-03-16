const express = require('express');
const router = express.Router();
const { authenticateJWT, requirePermission } = require('../config/security');
const ReceiptStubController = require('../controllers/receiptStubController');

router.post('/:bookID/collect', authenticateJWT, requirePermission('collect_receipt_stubs'), ReceiptStubController.collectStub);
router.post('/:bookID/validate-collection', authenticateJWT, requirePermission('validate_receipt_stubs'), ReceiptStubController.validateStubCollection);
router.post('/:bookID/transmit', authenticateJWT, requirePermission('transmit_receipt_stubs'), ReceiptStubController.transmitStub);
router.post('/:bookID/validate-transmit', authenticateJWT, requirePermission('validate_receipt_stubs'), ReceiptStubController.validateTransmitStub);
router.post('/:bookID/archive', authenticateJWT, requirePermission('archive_receipt_stubs'), ReceiptStubController.archiveStub);

module.exports = router;