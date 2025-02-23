// routes/agentRoutes.js
const express = require('express');
const router = express.Router();
const AgentController = require('../controllers/agentController');



// Fetch agents by location
router.get('/location', AgentController.getAgentsByLocation);

// Fetch all unique agent locations
router.get('/locations', AgentController.getAllUniqueLocations);


// Fetch an agent by phone number
router.get('/phone/:phone', AgentController.getAgentByPhone);


// Fetch an agent by ID
router.get('/:id', AgentController.getAgentById);

module.exports = router;