const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const ReceiptStubController = require('../controllers/receiptStubController');

router.post('/:bookID/collect', requirePermission('collect_receipt_stubs'), ReceiptStubController.collectStub);
router.post('/:bookID/validate-collection', requirePermission('validate_receipt_stubs'), ReceiptStubController.validateStubCollection);
router.post('/:bookID/archive', requirePermission('archive_receipt_stubs'), ReceiptStubController.archiveStub);

module.exports = router;