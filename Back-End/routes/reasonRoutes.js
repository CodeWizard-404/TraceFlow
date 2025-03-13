const express = require('express');
const router = express.Router();
const { authenticateJWT, requirePermission } = require('../config/security');
const ReasonController = require('../controllers/reasonController');

router.post('/', authenticateJWT, requirePermission('create_reason_items'), ReasonController.createReason);
router.get('/', authenticateJWT, requirePermission('read_reason_items'), ReasonController.getAllReasons);
router.get('/:id', authenticateJWT, requirePermission('read_reason_item_details'), ReasonController.getReasonsByVisitID);

module.exports = router;