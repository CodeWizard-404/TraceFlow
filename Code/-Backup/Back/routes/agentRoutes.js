const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const AgentController = require('../controllers/agentController');

router.get('/location', requirePermission('access_agents_by_location'), AgentController.getAgentsByLocation);
router.get('/locations', requirePermission('access_agents_locations'), AgentController.getAllUniqueLocations);
router.get('/phone/:phone', requirePermission('access_agents_by_phone'), AgentController.getAgentByPhone);
router.get('/:id', requirePermission('access_agents_by_id'), AgentController.getAgentById);

module.exports = router;