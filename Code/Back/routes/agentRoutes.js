const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const AgentController = require('../controllers/agentController');

// Routes for locations
router.get('/regions', requirePermission('access_regions'), AgentController.getAllRegions);
router.get('/governorates', requirePermission('access_governorates'), AgentController.getAllGovernorates);
router.get('/delegations', requirePermission('access_delegations'), AgentController.getAllDelegations);

// Other agent-related routes
router.get('/delegation', requirePermission('access_agents_by_delegation'), AgentController.getAgentsByDelegation);
router.get('/locations', requirePermission('access_agents_locations'), AgentController.getAllUniqueLocations);
router.get('/phone/:phone', requirePermission('access_agents_by_phone'), AgentController.getAgentByPhone);
router.get('/:id/supervisor', requirePermission('access_agent_supervisor'), AgentController.getAgentSupervisor);

// CRUD routes for agents
router.post('/', requirePermission('create_agents'), AgentController.createAgent);
router.get('/', requirePermission('access_all_agents'), AgentController.getAllAgents);
router.get('/:id', requirePermission('access_agents_by_id'), AgentController.getAgentById);
router.put('/:id', requirePermission('update_agents'), AgentController.updateAgent);
router.delete('/:id', requirePermission('delete_agents'), AgentController.deleteAgent);



module.exports = router;