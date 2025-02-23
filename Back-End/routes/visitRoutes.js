// visitRoutes.js
const express = require('express');
const router = express.Router();
const VisitController = require('../controllers/visitController');

// Create a new visit
router.post('/', VisitController.createVisit);

// Log visit details
router.put('/:id/log', VisitController.logVisit);

// Fetch a visit by ID
router.get('/:id', VisitController.getVisitByID);

module.exports = router;