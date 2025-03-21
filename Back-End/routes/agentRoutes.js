const express = require('express');
const router = express.Router();
const { authenticateJWT, requirePermission } = require('../config/security');
const AgentController = require('../controllers/agentController');

router.get('/location', authenticateJWT, requirePermission('read_agents_by_location'), AgentController.getAgentsByLocation);
router.get('/locations', authenticateJWT, requirePermission('read_agents_locations'), AgentController.getAllUniqueLocations);
router.get('/phone/:phone', authenticateJWT, requirePermission('read_agents_by_phone'), AgentController.getAgentByPhone);
router.get('/:id', authenticateJWT, requirePermission('read_agents_by_id'), AgentController.getAgentById);

module.exports = router;