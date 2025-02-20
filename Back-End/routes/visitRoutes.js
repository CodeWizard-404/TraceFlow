const express = require('express');
const router = express.Router();
const VisitController = require('../controllers/visitController');

// Create a new visit
router.post('/visits', VisitController.createVisit);

// Log details for an existing visit (e.g., checklist, photos, comments)
router.put('/visits/:id/log', VisitController.logVisit);

module.exports = router;