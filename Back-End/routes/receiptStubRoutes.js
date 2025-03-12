const express = require('express');
const router = express.Router();
const ReceiptStubController = require('../controllers/receiptStubController');
const { authenticateJWT, restrictTo } = require('../config/security');

router.post('/collect', authenticateJWT, restrictTo('Supervisor'), ReceiptStubController.collectStub);
router.post('/validate-collection', authenticateJWT, restrictTo('Supervisor'), ReceiptStubController.validateStubCollection);
router.post('/transmit', authenticateJWT, restrictTo('Supervisor', 'Regional Manager'), ReceiptStubController.transmitStub);

module.exports = router;