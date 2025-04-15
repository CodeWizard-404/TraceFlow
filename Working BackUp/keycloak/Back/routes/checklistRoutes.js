const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const ChecklistController = require('../controllers/checklistController');

router.post('/', requirePermission('create_checklists_items'), ChecklistController.createChecklist);
router.get('/:id', requirePermission('access_checklist_item_details'), ChecklistController.getChecklistByID)
router.put('/:id', requirePermission('update_checklists_items'), ChecklistController.updateChecklist);
router.delete('/:id', requirePermission('delete_checklists_items'), ChecklistController.deleteChecklist);
router.get('/', requirePermission('access_checklists_items'), ChecklistController.getAllChecklists);
router.get('/visit/:id', requirePermission('access_visit_checklist'), ChecklistController.getChecklistsByVisitID);

module.exports = router;