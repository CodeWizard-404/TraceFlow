const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const ReasonController = require('../controllers/reasonController');

router.post('/', requirePermission('create_reason_items'), ReasonController.createReason);
router.get('/:id', requirePermission('access_reason_item_details'), ReasonController.getReasonByID);
router.put('/:id', requirePermission('update_reason_items'), ReasonController.updateReason);
router.delete('/:id', requirePermission('delete_reason_items'), ReasonController.deleteReason);
router.get('/', requirePermission('access_reason_items'), ReasonController.getAllReasons);
router.get('/visit/:id', requirePermission('access_visit_reasons'), ReasonController.getReasonsByVisitID);

module.exports = router;