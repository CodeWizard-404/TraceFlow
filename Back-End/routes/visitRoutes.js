// visitRoutes.js
const express = require('express');
const router = express.Router();
const VisitController = require('../controllers/visitController');

// Create a new visit
router.post('/', VisitController.createVisit);

// Log visit details
router.put('/:id/log', VisitController.logVisit);

module.exports = router;