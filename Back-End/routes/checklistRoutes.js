const express = require('express');
const router = express.Router();
const { authenticateJWT, requirePermission } = require('../config/security');
const ChecklistController = require('../controllers/checklistController');

router.post('/', authenticateJWT, requirePermission('create_checklists_items'), ChecklistController.createChecklist);
router.get('/:id', authenticateJWT, requirePermission('access_checklist_item_details'), ChecklistController.getChecklistByID)
router.put('/:id', authenticateJWT, requirePermission('update_checklists_items'), ChecklistController.updateChecklist);
router.delete('/:id', authenticateJWT, requirePermission('delete_checklists_items'), ChecklistController.deleteChecklist);
router.get('/', authenticateJWT, requirePermission('access_checklists_items'), ChecklistController.getAllChecklists);
router.get('/visit/:id', authenticateJWT, requirePermission('access_visit_checklist'), ChecklistController.getChecklistsByVisitID);

module.exports = router;