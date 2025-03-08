// visitRoutes.js
const express = require('express');
const router = express.Router();
const ReasonController = require('../controllers/reasonController');

// Create a new Reason
router.post('/', ReasonController.createReason);

// Fetch a Reason by visitID
router.get('/:id', ReasonController.getReasonsByVisitID);

// Fetch all Reasons
router.get('/', ReasonController.getAllChecklists);

module.exports = router;