const express = require('express');
const router = express.Router();
const ChecklistController = require('../controllers/checklistController');

// Create a new Checklist Item
router.post('/', ChecklistController.createChecklist);

// Fetch a Checklists Items by visitID
router.get('/:id', ChecklistController.getChecklistsByVisitID);

// Fetch all Checklists Items
router.get('/', ChecklistController.getAllChecklists);

module.exports = router;