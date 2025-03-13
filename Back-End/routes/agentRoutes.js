const express = require('express');
const router = express.Router();
const { authenticateJWT, requirePermission } = require('../config/security');
const AgentController = require('../controllers/agentController');

router.get('/location', authenticateJWT, requirePermission('read_agents'), AgentController.getAgentsByLocation);
router.get('/locations', authenticateJWT, requirePermission('read_agents'), AgentController.getAllUniqueLocations);
router.get('/phone/:phone', authenticateJWT, requirePermission('read_agents'), AgentController.getAgentByPhone);
router.get('/:id', authenticateJWT, requirePermission('read_agents'), AgentController.getAgentById);

module.exports = router;