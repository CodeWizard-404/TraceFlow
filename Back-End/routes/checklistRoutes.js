const express = require('express');
const router = express.Router();
const { authenticateJWT, requirePermission } = require('../config/security');
const ChecklistController = require('../controllers/checklistController');

router.post('/', authenticateJWT, requirePermission('create_checklists_items'), ChecklistController.createChecklist);
router.get('/', authenticateJWT, requirePermission('access_checklists_items'), ChecklistController.getAllChecklists);
router.get('/:id', authenticateJWT, requirePermission('access_checklist_item_details'), ChecklistController.getChecklistsByVisitID);

module.exports = router;