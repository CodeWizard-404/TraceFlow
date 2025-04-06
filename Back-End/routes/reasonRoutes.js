const express = require('express');
const router = express.Router();
const { authenticateJWT, requirePermission } = require('../config/security');
const ReasonController = require('../controllers/reasonController');

router.post('/', authenticateJWT, requirePermission('create_reason_items'), ReasonController.createReason);
router.get('/:id', authenticateJWT, requirePermission('access_reason_item_details'), ReasonController.getReasonByID);
router.put('/:id', authenticateJWT, requirePermission('update_reason_items'), ReasonController.updateReason);
router.delete('/:id', authenticateJWT, requirePermission('delete_reason_items'), ReasonController.deleteReason);
router.get('/', authenticateJWT, requirePermission('access_reason_items'), ReasonController.getAllReasons);
router.get('/visit/:id', authenticateJWT, requirePermission('access_visit_reasons'), ReasonController.getReasonsByVisitID);

module.exports = router;