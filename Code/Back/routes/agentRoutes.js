const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const AgentController = require('../controllers/agentController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Other agent-related routes
router.get('/delegation', requirePermission('access_agents_by_delegation'), AgentController.getAgentsByDelegation);
router.get('/locations', requirePermission('access_agents_locations'), AgentController.getAllUniqueLocations);
router.get('/phone/:phone', requirePermission('access_agents_by_phone'), AgentController.getAgentByPhone);
router.get('/:id/supervisor', requirePermission('access_agent_supervisor'), AgentController.getAgentSupervisor);

// get agents by user
router.get('/user/:id', requirePermission('access_agents_by_user'), AgentController.getAgentsByUser);



// CSV upload route
router.post('/upload', requirePermission('create_agents'), upload.single('file'), AgentController.uploadAgents);

// Google Maps API routes
router.get('/map/locations', requirePermission('access_agent_map_locations'), AgentController.getAgentLocations);
router.get('/nearby', requirePermission('access_nearby_agents'), AgentController.getNearbyAgents);
router.get('/bounds', requirePermission('access_agents_by_bounds'), AgentController.getAgentsByBounds);
router.post('/correct-location', requirePermission('update_agents_location'), AgentController.correctAgentLocation);





// CRUD routes for agents
router.post('/', requirePermission('create_agents'), AgentController.createAgent);
router.get('/', requirePermission('access_all_agents'), AgentController.getAllAgents);
router.get('/:id', requirePermission('access_agents_by_id'), AgentController.getAgentById);
router.put('/:id', requirePermission('update_agents'), AgentController.updateAgent);
router.delete('/:id', requirePermission('delete_agents'), AgentController.deleteAgent);

module.exports = router;