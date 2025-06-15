const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const AgentController = require('../controllers/agentController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * tags:
 *   name: Agents
 *   description: Endpoints for managing agents
 */

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     cookieAuth:
 *       type: apiKey
 *       in: cookie
 *       name: accessToken
 *   schemas:
 *     Agent:
 *       type: object
 *       properties:
 *         agentID:
 *           type: string
 *           description: Unique identifier for the agent
 *         name:
 *           type: string
 *           description: Agent's first name
 *         lastname:
 *           type: string
 *           description: Agent's last name
 *         email:
 *           type: string
 *           description: Agent's email address
 *         phone:
 *           type: string
 *           description: Agent's phone number
 *         supervisorID:
 *           type: string
 *           description: ID of the agent's supervisor
 *         delegationID:
 *           type: string
 *           description: ID of the agent's delegation
 *         latitude:
 *           type: number
 *           description: Latitude of the agent's location
 *         longitude:
 *           type: number
 *           description: Longitude of the agent's location
 *         location:
 *           type: string
 *           description: Agent's location as a coordinate string (e.g., "lat,lng")
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         Supervisor:
 *           $ref: '#/components/schemas/User'
 *         Delegation:
 *           $ref: '#/components/schemas/Delegation'
 *     User:
 *       type: object
 *       properties:
 *         userID:
 *           type: string
 *           description: Unique identifier for the user
 *         firstname:
 *           type: string
 *           description: User's first name
 *         lastname:
 *           type: string
 *           description: User's last name
 *         email:
 *           type: string
 *           description: User's email address
 *         phone:
 *           type: string
 *           description: User's phone number
 *     Delegation:
 *       type: object
 *       properties:
 *         delegationID:
 *           type: string
 *           description: Unique identifier for the delegation
 *         name:
 *           type: string
 *           description: Name of the delegation
 *         Governorate:
 *           $ref: '#/components/schemas/Governorate'
 *     Governorate:
 *       type: object
 *       properties:
 *         governorateID:
 *           type: string
 *           description: Unique identifier for the governorate
 *         name:
 *           type: string
 *           description: Name of the governorate
 *     NewAgent:
 *       type: object
 *       required:
 *         - name
 *         - lastname
 *         - email
 *         - phone
 *         - supervisorID
 *         - delegationID
 *       properties:
 *         name:
 *           type: string
 *           description: Agent's first name
 *         lastname:
 *           type: string
 *           description: Agent's last name
 *         email:
 *           type: string
 *           description: Agent's email address
 *         phone:
 *           type: string
 *           description: Agent's phone number
 *         supervisorID:
 *           type: string
 *           description: ID of the agent's supervisor
 *         delegationID:
 *           type: string
 *           description: ID of the agent's delegation
 *         latitude:
 *           type: number
 *           description: Latitude of the agent's location
 *         longitude:
 *           type: number
 *           description: Longitude of the agent's location
 *         locationAddress:
 *           type: string
 *           description: Address to geocode if coordinates are not provided
 *     UpdateAgent:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Agent's first name
 *         lastname:
 *           type: string
 *           description: Agent's last name
 *         email:
 *           type: string
 *           description: Agent's email address
 *         phone:
 *           type: string
 *           description: Agent's phone number
 *         supervisorID:
 *           type: string
 *           description: ID of the agent's supervisor
 *         delegationID:
 *           type: string
 *           description: ID of the agent's delegation
 *     CorrectLocation:
 *       type: object
 *       required:
 *         - agentId
 *         - latitude
 *         - longitude
 *         - address
 *       properties:
 *         agentId:
 *           type: string
 *           description: ID of the agent
 *         latitude:
 *           type: number
 *           description: New latitude
 *         longitude:
 *           type: number
 *           description: New longitude
 *         address:
 *           type: string
 *           description: New address
 *     NearbyAgent:
 *       allOf:
 *         - $ref: '#/components/schemas/Agent'
 *         - type: object
 *           properties:
 *             distance:
 *               type: number
 *               description: Distance from the specified location in kilometers
 *     UploadResult:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, completed_successfully, completed_with_issues, failed]
 *           description: Status of the CSV processing
 *         summary:
 *           type: object
 *           properties:
 *             totalRecords:
 *               type: integer
 *               description: Total number of records processed
 *             agentsCreated:
 *               type: integer
 *               description: Number of agents created
 *             agentsUpdated:
 *               type: integer
 *               description: Number of agents updated
 *             recordsSkipped:
 *               type: integer
 *               description: Number of records skipped
 *             errorsEncountered:
 *               type: integer
 *               description: Number of errors encountered
 *         detailedLog:
 *           type: object
 *           properties:
 *             created:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   agentPhone:
 *                     type: string
 *                   agentName:
 *                     type: string
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                   details:
 *                     type: string
 *             updated:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   agentPhone:
 *                     type: string
 *                   agentName:
 *                     type: string
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                   details:
 *                     type: string
 *             skipped:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   agentPhone:
 *                     type: string
 *                   agentName:
 *                     type: string
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                   reason:
 *                     type: string
 *             errors:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   agentPhone:
 *                     type: string
 *                   agentName:
 *                     type: string
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                   operation:
 *                     type: string
 *                   reason:
 *                     type: string
 */

/**
 * @swagger
 * /api/agents/delegation:
 *   get:
 *     summary: Get agents by delegation
 *     description: Retrieves a list of agents belonging to a specific delegation. Requires `access_agents_by_delegation` permission.
 *     tags: [Agents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: delegationID
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the delegation to filter agents by
 *     responses:
 *       200:
 *         description: Successfully retrieved agents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Agent'
 *       400:
 *         description: Missing delegationID parameter
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/delegation', requirePermission('access_agents_by_delegation'), AgentController.getAgentsByDelegation);

/**
 * @swagger
 * /api/agents/locations:
 *   get:
 *     summary: Get all unique agent locations
 *     description: Retrieves a list of unique delegation names where agents are located. Requires `access_agents_locations` permission.
 *     tags: [Agents]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved unique locations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *                 description: Delegation name
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/locations', requirePermission('access_agents_locations'), AgentController.getAllUniqueLocations);

/**
 * @swagger
 * /api/agents/phone/{phone}:
 *   get:
 *     summary: Get agent by phone number
 *     description: Retrieves an agent by their phone number. Requires `access_agents_by_phone` permission.
 *     tags: [Agents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *         description: Phone number of the agent
 *     responses:
 *       200:
 *         description: Successfully retrieved agent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       400:
 *         description: Missing phone parameter
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Agent not found
 *       500:
 *         description: Internal server error
 */
router.get('/phone/:phone', requirePermission('access_agents_by_phone'), AgentController.getAgentByPhone);

/**
 * @swagger
 * /api/agents/{id}/supervisor:
 *   get:
 *     summary: Get an agent's supervisor
 *     description: Retrieves the supervisor details for a specific agent. Requires `access_agent_supervisor` permission.
 *     tags: [Agents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the agent
 *     responses:
 *       200:
 *         description: Successfully retrieved supervisor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing agent ID
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Supervisor not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id/supervisor', requirePermission('access_agent_supervisor'), AgentController.getAgentSupervisor);

/**
 * @swagger
 * /api/agents/user/{id}:
 *   get:
 *     summary: Get agents by user (supervisor)
 *     description: Retrieves a list of agents supervised by a specific user. Requires `access_agents_by_user` permission.
 *     tags: [Agents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user (supervisor)
 *     responses:
 *       200:
 *         description: Successfully retrieved agents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Agent'
 *       400:
 *         description: Missing user ID
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/user/:id', requirePermission('access_agents_by_user'), AgentController.getAgentsByUser);

/**
 * @swagger
 * /api/agents/upload:
 *   post:
 *     summary: Upload agents via CSV
 *     description: Processes a CSV file to create or update agents in bulk. Requires `create_agents` permission.
 *     tags: [Agents]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file containing agent data
 *     responses:
 *       200:
 *         description: CSV processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UploadResult'
 *       400:
 *         description: Missing CSV file or validation errors
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/upload', requirePermission('create_agents'), upload.single('file'), AgentController.uploadAgents);

/**
 * @swagger
 * /api/agents/map/locations:
 *   get:
 *     summary: Get all agent locations for mapping
 *     description: Retrieves all agent locations for display on a map. Requires `access_agent_map_locations` permission.
 *     tags: [Agents]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved agent locations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 locations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       agentId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       lastname:
 *                         type: string
 *                       email:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       latitude:
 *                         type: number
 *                       longitude:
 *                         type: number
 *                       address:
 *                         type: string
 *                       source:
 *                         type: string
 *                       delegation:
 *                         $ref: '#/components/schemas/Delegation'
 *                 center:
 *                   type: object
 *                   properties:
 *                     lat:
 *                       type: number
 *                     lng:
 *                       type: number
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/map/locations', requirePermission('access_agent_map_locations'), AgentController.getAgentLocations);

/**
 * @swagger
 * /api/agents/nearby:
 *   get:
 *     summary: Get nearby agents
 *     description: Retrieves agents within a specified radius of a location. Requires `access_nearby_agents` permission.
 *     tags: [Agents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *         description: Latitude of the reference point
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *         description: Longitude of the reference point
 *       - in: query
 *         name: radius
 *         required: false
 *         schema:
 *           type: number
 *           default: 5000
 *         description: Radius in meters (default is 5000m)
 *     responses:
 *       200:
 *         description: Successfully retrieved nearby agents
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/NearbyAgent'
 *       400:
 *         description: Missing latitude or longitude
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/nearby', requirePermission('access_nearby_agents'), AgentController.getNearbyAgents);

/**
 * @swagger
 * /api/agents/bounds:
 *   get:
 *     summary: Get agents within bounds
 *     description: Retrieves agents within specified geographical bounds. Requires `access_agents_by_bounds` permission.
 *     tags: [Agents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: southWestLat
 *         required: true
 *         schema:
 *           type: number
 *         description: Southwest latitude bound
 *       - in: query
 *         name: southWestLng
 *         required: true
 *         schema:
 *           type: number
 *         description: Southwest longitude bound
 *       - in: query
 *         name: northEastLat
 *         required: true
 *         schema:
 *           type: number
 *         description: Northeast latitude bound
 *       - in: query
 *         name: northEastLng
 *         required: true
 *         schema:
 *           type: number
 *         description: Northeast longitude bound
 *     responses:
 *       200:
 *         description: Successfully retrieved agents within bounds
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Agent'
 *       400:
 *         description: Missing bound coordinates
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/bounds', requirePermission('access_agents_by_bounds'), AgentController.getAgentsByBounds);

/**
 * @swagger
 * /api/agents/correct-location:
 *   post:
 *     summary: Correct an agent's location
 *     description: Updates an agent's location with new coordinates and address. Requires `update_agents_location` permission.
 *     tags: [Agents]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CorrectLocation'
 *     responses:
 *       200:
 *         description: Location corrected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agentId:
 *                   type: string
 *                 latitude:
 *                   type: number
 *                 longitude:
 *                   type: number
 *                 address:
 *                   type: string
 *                 delegation:
 *                   $ref: '#/components/schemas/Delegation'
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/correct-location', requirePermission('update_agents_location'), AgentController.correctAgentLocation);

/**
 * @swagger
 * /api/agents:
 *   post:
 *     summary: Create a new agent
 *     description: Creates a new agent with the provided details. Requires `create_agents` permission.
 *     tags: [Agents]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewAgent'
 *     responses:
 *       201:
 *         description: Agent created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       400:
 *         description: Validation errors or duplicate agent
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/', requirePermission('create_agents'), AgentController.createAgent);

/**
 * @swagger
 * /api/agents:
 *   get:
 *     summary: Get all agents
 *     description: Retrieves a list of all agents. Requires `access_all_agents` permission.
 *     tags: [Agents]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved all agents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Agent'
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/', requirePermission('access_all_agents'), AgentController.getAllAgents);

/**
 * @swagger
 * /api/agents/{id}:
 *   get:
 *     summary: Get an agent by ID
 *     description: Retrieves details of a specific agent by ID. Requires `access_agents_by_id` permission.
 *     tags: [Agents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the agent
 *     responses:
 *       200:
 *         description: Successfully retrieved agent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       400:
 *         description: Missing agent ID
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Agent not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', requirePermission('access_agents_by_id'), AgentController.getAgentById);

/**
 * @swagger
 * /api/agents/{id}:
 *   put:
 *     summary: Update an agent
 *     description: Updates an existing agent's details. Requires `update_agents` permission.
 *     tags: [Agents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the agent to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateAgent'
 *     responses:
 *       200:
 *         description: Agent updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       400:
 *         description: Validation errors or missing agent ID
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.put('/:id', requirePermission('update_agents'), AgentController.updateAgent);

/**
 * @swagger
 * /api/agents/{id}:
 *   delete:
 *     summary: Delete an agent
 *     description: Deletes an agent by ID. Requires `delete_agents` permission.
 *     tags: [Agents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the agent to delete
 *     responses:
 *       200:
 *         description: Agent deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Agent deleted successfully
 *       400:
 *         description: Missing agent ID
 *       401:
 *         description: Unauthorized - No valid authentication
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', requirePermission('delete_agents'), AgentController.deleteAgent);

module.exports = router;