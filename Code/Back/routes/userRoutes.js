const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { requirePermission } = require('../config/security');
const { uploadPFP } = require('../config/multer');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         userID:
 *           type: string
 *           description: Unique identifier for the user
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         firstname:
 *           type: string
 *           description: User's first name
 *         lastname:
 *           type: string
 *           description: User's last name
 *         phone:
 *           type: string
 *           description: User's phone number
 *         PFP:
 *           type: string
 *           format: base64
 *           description: User's profile picture in base64 format (optional)
 *         Roles:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Role name assigned to the user
 *           description: List of roles assigned to the user
 *         Regions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               regionID:
 *                 type: string
 *                 description: Unique identifier for the region
 *               name:
 *                 type: string
 *                 description: Name of the region
 *           description: List of regions assigned to the user
 *         Governorates:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               governorateID:
 *                 type: string
 *                 description: Unique identifier for the governorate
 *               name:
 *                 type: string
 *                 description: Name of the governorate
 *           description: List of governorates assigned to the user
 *         Delegations:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               delegationID:
 *                 type: string
 *                 description: Unique identifier for the delegation
 *               name:
 *                 type: string
 *                 description: Name of the delegation
 *           description: List of delegations assigned to the user
 *         RegionalManager:
 *           type: object
 *           properties:
 *             userID:
 *               type: string
 *               description: ID of the regional manager
 *             firstname:
 *               type: string
 *               description: First name of the regional manager
 *             lastname:
 *               type: string
 *               description: Last name of the regional manager
 *             email:
 *               type: string
 *               format: email
 *               description: Email of the regional manager
 *           description: Details of the user's regional manager (optional)
 *         Director:
 *           type: object
 *           properties:
 *             userID:
 *               type: string
 *               description: ID of the director
 *             firstname:
 *               type: string
 *               description: First name of the director
 *             lastname:
 *               type: string
 *               description: Last name of the director
 *             email:
 *               type: string
 *               format: email
 *               description: Email of the director
 *           description: Details of the user's director (optional)
 *         Agents:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               agentID:
 *                 type: string
 *                 description: Unique identifier for the agent
 *               name:
 *                 type: string
 *                 description: First name of the agent
 *               lastname:
 *                 type: string
 *                 description: Last name of the agent
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email of the agent
 *           description: List of agents assigned to the user (optional)
 */

/**
 * @swagger
 * /api/users/assign-regional-manager:
 *   post:
 *     summary: Assign a regional manager to a supervisor
 *     description: Assigns a regional manager to a supervisor. Requires 'assign_regional_manager' permission. Triggers a notification and invalidates cache.
 *     tags: [User Assignments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - supervisorID
 *               - regionalManagerID
 *             properties:
 *               supervisorID:
 *                 type: string
 *                 description: ID of the supervisor to assign the regional manager to
 *               regionalManagerID:
 *                 type: string
 *                 description: ID of the regional manager to be assigned
 *     responses:
 *       200:
 *         description: Regional manager assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 supervisorID:
 *                   type: string
 *                   description: ID of the supervisor
 *                 regionalManagerID:
 *                   type: string
 *                   description: ID of the assigned regional manager
 *                 message:
 *                   type: string
 *                   description: Success message
 *       400:
 *         description: Missing required fields or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Supervisor or regional manager not found
 *       500:
 *         description: Internal server error
 */
router.post('/assign-regional-manager', requirePermission('assign_regional_manager'), UserController.assignRegionalManagerToSupervisor);

/**
 * @swagger
 * /api/users/revoke-regional-manager:
 *   post:
 *     summary: Revoke a regional manager from a supervisor
 *     description: Revokes the regional manager assignment from a supervisor, with optional cascading revocation of governorates, delegations, and agents. Requires 'revoke_regional_manager' permission. Triggers a notification and invalidates cache.
 *     tags: [User Assignments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - supervisorID
 *             properties:
 *               supervisorID:
 *                 type: string
 *                 description: ID of the supervisor to revoke the regional manager from
 *               confirmations:
 *                 type: object
 *                 properties:
 *                   revokeAll:
 *                     type: boolean
 *                     description: Whether to revoke associated governorates, delegations, and agents (default: false)
 *                 description: Optional confirmations for cascading revocation
 *     responses:
 *       200:
 *         description: Regional manager revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 supervisorID:
 *                   type: string
 *                   description: ID of the supervisor
 *                 regionalManagerID:
 *                   type: string
 *                   description: ID of the revoked regional manager (null if none was assigned)
 *                 message:
 *                   type: string
 *                   description: Success message
 *                 cascadeApplied:
 *                   type: object
 *                   properties:
 *                     governorates:
 *                       type: boolean
 *                       description: Whether governorates were revoked
 *                     delegations:
 *                       type: boolean
 *                       description: Whether delegations were revoked
 *                     agents:
 *                       type: boolean
 *                       description: Whether agents were revoked
 *                   description: Indicates which associations were revoked
 *                 affectedCounts:
 *                   type: object
 *                   properties:
 *                     governorates:
 *                       type: integer
 *                       description: Number of governorates affected
 *                     delegations:
 *                       type: integer
 *                       description: Number of delegations affected
 *                     agents:
 *                       type: integer
 *                       description: Number of agents affected
 *                   description: Counts of affected associations
 *       400:
 *         description: Missing required fields or confirmation required for cascading revocation
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Supervisor not found
 *       500:
 *         description: Internal server error
 */
router.post('/revoke-regional-manager', requirePermission('revoke_regional_manager'), UserController.revokeRegionalManagerFromSupervisor);

/**
 * @swagger
 * /api/users/assign-director:
 *   post:
 *     summary: Assign a director to a regional manager
 *     description: Assigns a director to a regional manager. Requires 'assign_director' permission. Triggers a notification and invalidates cache.
 *     tags: [User Assignments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - regionalManagerID
 *               - directorID
 *             properties:
 *               regionalManagerID:
 *                 type: string
 *                 description: ID of the regional manager to assign the director to
 *               directorID:
 *                 type: string
 *                 description: ID of the director to be assigned
 *     responses:
 *       200:
 *         description: Director assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 regionalManagerID:
 *                   type: string
 *                   description: ID of the regional manager
 *                 directorID:
 *                   type: string
 *                   description: ID of the assigned director
 *                 message:
 *                   type: string
 *                   description: Success message
 *       400:
 *         description: Missing required fields or invalid input
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Regional manager or director not found
 *       500:
 *         description: Internal server error
 */
router.post('/assign-director', requirePermission('assign_director'), UserController.assignDirectorToRegionalManager);

/**
 * @swagger
 * /api/users/revoke-director:
 *   post:
 *     summary: Revoke a director from a regional manager
 *     description: Revokes the director assignment from a regional manager. Requires 'revoke_director' permission. Triggers a notification and invalidates cache.
 *     tags: [User Assignments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - regionalManagerID
 *             properties:
 *               regionalManagerID:
 *                 type: string
 *                 description: ID of the regional manager to revoke the director from
 *     responses:
 *       200:
 *         description: Director revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 regionalManagerID:
 *                   type: string
 *                   description: ID of the regional manager
 *                 directorID:
 *                   type: string
 *                   description: ID of the revoked director (null if none was assigned)
 *                 message:
 *                   type: string
 *                   description: Success message
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Regional manager not found
 *       500:
 *         description: Internal server error
 */
router.post('/revoke-director', requirePermission('revoke_director'), UserController.revokeDirectorFromRegionalManager);

/**
 * @swagger
 * /api/users/assign-supervisor-to-agent:
 *   post:
 *     summary: Assign a supervisor to an agent
 *     description: Assigns a supervisor to an agent within a specific delegation. Requires 'assign_supervisor_to_agent' permission. Triggers a notification and invalidates cache.
 *     tags: [User Assignments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agentID
 *               - supervisorID
 *               - delegationID
 *             properties:
 *               agentID:
 *                 type: string
 *                 description: ID of the agent to assign the supervisor to
 *               supervisorID:
 *                 type: string
 *                 description: ID of the supervisor to be assigned
 *               delegationID:
 *                 type: string
 *                 description: ID of the delegation where the assignment applies
 *     responses:
 *       200:
 *         description: Supervisor assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Indicates if the operation was successful
 *                 agentID:
 *                   type: string
 *                   description: ID of the agent
 *                 supervisorID:
 *                   type: string
 *                   description: ID of the assigned supervisor
 *                 delegationID:
 *                   type: string
 *                   description: ID of the delegation
 *                 message:
 *                   type: string
 *                   description: Success message
 *       400:
 *         description: Missing required fields or invalid input (e.g., delegation not assigned to supervisor)
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Agent, supervisor, or delegation not found
 *       500:
 *         description: Internal server error
 */
router.post('/assign-supervisor-to-agent', requirePermission('assign_supervisor_to_agent'), UserController.assignSupervisorToAgent);

/**
 * @swagger
 * /api/users/revoke-supervisor-from-agent:
 *   post:
 *     summary: Revoke a supervisor from an agent
 *     description: Revokes the supervisor assignment from an agent. Requires 'revoke_supervisor_from_agent' permission. Triggers a notification and invalidates cache.
 *     tags: [User Assignments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agentID
 *             properties:
 *               agentID:
 *                 type: string
 *                 description: ID of the agent to revoke the supervisor from
 *     responses:
 *       200:
 *         description: Supervisor revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agentID:
 *                   type: string
 *                   description: ID of the agent
 *                 supervisorID:
 *                   type: string
 *                   description: ID of the revoked supervisor (null if none was assigned)
 *                 delegationID:
 *                   type: string
 *                   description: ID of the delegation (null if none was assigned)
 *                 message:
 *                   type: string
 *                   description: Success message
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Agent not found
 *       500:
 *         description: Internal server error
 */
router.post('/revoke-supervisor-from-agent', requirePermission('revoke_supervisor_from_agent'), UserController.revokeSupervisorFromAgent);

/**
 * @swagger
 * /api/users/assign-regions:
 *   post:
 *     summary: Assign regions to a regional manager
 *     description: Assigns one or more regions to a regional manager. Requires 'assign_regions' permission. Triggers a notification and invalidates cache.
 *     tags: [User Assignments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - regionalManagerID
 *               - regionIDs
 *             properties:
 *               regionalManagerID:
 *                 type: string
 *                 description: ID of the regional manager to assign regions to
 *               regionIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of region IDs to be assigned
 *     responses:
 *       200:
 *         description: Regions assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   userID:
 *                     type: string
 *                     description: ID of the regional manager
 *                   regionID:
 *                     type: string
 *                     description: ID of the assigned region
 *                   message:
 *                     type: string
 *                     description: Success message
 *       400:
 *         description: Missing required fields or invalid input
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Regional manager or region not found
 *       500:
 *         description: Internal server error
 */
router.post('/assign-regions', requirePermission('assign_regions'), UserController.assignRegionsToRegionalManager);

/**
 * @swagger
 * /api/users/revoke-regions:
 *   post:
 *     summary: Revoke regions from a regional manager
 *     description: Revokes one or more regions from a regional manager, with optional cascading revocation of supervisors. Requires 'revoke_regions' permission. Triggers a notification and invalidates cache.
 *     tags: [User Assignments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - regionalManagerID
 *               - regionIDs
 *             properties:
 *               regionalManagerID:
 *                 type: string
 *                 description: ID of the regional manager to revoke regions from
 *               regionIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of region IDs to be revoked
 *               confirmations:
 *                 type: object
 *                 properties:
 *                   revokeSupervisors:
 *                     type: boolean
 *                     description: Whether to revoke supervisors associated with the regions (default: false)
 *                 description: Optional confirmations for cascading revocation
 *     responses:
 *       200:
 *         description: Regions revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 regionalManagerID:
 *                   type: string
 *                   description: ID of the regional manager
 *                 regionIDs:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of revoked region IDs
 *                 message:
 *                   type: string
 *                   description: Success message
 *                 cascadeApplied:
 *                   type: object
 *                   properties:
 *                     supervisors:
 *                       type: boolean
 *                       description: Whether supervisors were revoked
 *                   description: Indicates which associations were revoked
 *                 affectedCounts:
 *                   type: object
 *                   properties:
 *                     supervisors:
 *                       type: integer
 *                       description: Number of supervisors affected
 *                   description: Counts of affected associations
 *       400:
 *         description: Missing required fields or confirmation required for cascading revocation
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Regional manager or region not found
 *       500:
 *         description: Internal server error
 */
router.post('/revoke-regions', requirePermission('revoke_regions'), UserController.revokeRegionsFromRegionalManager);

/**
 * @swagger
 * /api/users/assign-governorates:
 *   post:
 *     summary: Assign governorates to a supervisor
 *     description: Assigns one or more governorates to a supervisor. Requires 'assign_governorates' permission. Triggers a notification and invalidates cache.
 *     tags: [User Assignments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - supervisorID
 *               - governorateIDs
 *             properties:
 *               supervisorID:
 *                 type: string
 *                 description: ID of the supervisor to assign governorates to
 *               governorateIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of governorate IDs to be assigned
 *     responses:
 *       200:
 *         description: Governorates assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   success:
 *                     type: boolean
 *                     description: Indicates if the operation was successful
 *                   userID:
 *                     type: string
 *                     description: ID of the supervisor
 *                   governorateID:
 *                     type: string
 *                     description: ID of the assigned governorate
 *                   message:
 *                     type: string
 *                     description: Success message
 *       400:
 *         description: Missing required fields or invalid input
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Supervisor or governorate not found
 *       500:
 *         description: Internal server error
 */
router.post('/assign-governorates', requirePermission('assign_governorates'), UserController.assignGovernoratesToSupervisor);

/**
 * @swagger
 * /api/users/revoke-governorates:
 *   post:
 *     summary: Revoke governorates from a supervisor
 *     description: Revokes one or more governorates from a supervisor, with optional cascading revocation of delegations and agents. Requires 'revoke_governorates' permission. Triggers a notification and invalidates cache.
 *     tags: [User Assignments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - supervisorID
 *               - governorateIDs
 *             properties:
 *               supervisorID:
 *                 type: string
 *                 description: ID of the supervisor to revoke governorates from
 *               governorateIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of governorate IDs to be revoked
 *               confirmations:
 *                 type: object
 *                 properties:
 *                   revokeAll:
 *                     type: boolean
 *                     description: Whether to revoke associated delegations and agents (default: false)
 *                 description: Optional confirmations for cascading revocation
 *     responses:
 *       200:
 *         description: Governorates revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 supervisorID:
 *                   type: string
 *                   description: ID of the supervisor
 *                 governorateIDs:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of revoked governorate IDs
 *                 message:
 *                   type: string
 *                   description: Success message
 *                 cascadeApplied:
 *                   type: object
 *                   properties:
 *                     delegations:
 *                       type: boolean
 *                       description: Whether delegations were revoked
 *                     agents:
 *                       type: boolean
 *                       description: Whether agents were revoked
 *                   description: Indicates which associations were revoked
 *                 affectedCounts:
 *                   type: object
 *                   properties:
 *                     delegations:
 *                       type: integer
 *                       description: Number of delegations affected
 *                     agents:
 *                       type: integer
 *                       description: Number of agents affected
 *                   description: Counts of affected associations
 *       400:
 *         description: Missing required fields or confirmation required for cascading revocation
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Supervisor or governorate not found
 *       500:
 *         description: Internal server error
 */
router.post('/revoke-governorates', requirePermission('revoke_governorates'), UserController.revokeGovernoratesFromSupervisor);

/**
 * @swagger
 * /api/users/assign-delegations:
 *   post:
 *     summary: Assign delegations to a supervisor
 *     description: Assigns one or more delegations to a supervisor. Requires 'assign_delegations' permission. Triggers a notification and invalidates cache.
 *     tags: [User Assignments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - supervisorID
 *               - delegationIDs
 *             properties:
 *               supervisorID:
 *                 type: string
 *                 description: ID of the supervisor to assign delegations to
 *               delegationIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of delegation IDs to be assigned
 *     responses:
 *       200:
 *         description: Delegations assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   success:
 *                     type: boolean
 *                     description: Indicates if the operation was successful
 *                   userID:
 *                     type: string
 *                     description: ID of the supervisor
 *                   delegationID:
 *                     type: string
 *                     description: ID of the assigned delegation
 *                   message:
 *                     type: string
 *                     description: Success message
 *       400:
 *         description: Missing required fields or invalid input (e.g., governorate not assigned to supervisor)
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Supervisor or delegation not found
 *       500:
 *         description: Internal server error
 */
router.post('/assign-delegations', requirePermission('assign_delegations'), UserController.assignDelegationsToSupervisor);

/**
 * @swagger
 * /api/users/revoke-delegations:
 *   post:
 *     summary: Revoke delegations from a supervisor
 *     description: Revokes one or more delegations from a supervisor, with optional cascading revocation of agents. Requires 'revoke_delegations' permission. Triggers a notification and invalidates cache.
 *     tags: [User Assignments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - supervisorID
 *               - delegationIDs
 *             properties:
 *               supervisorID:
 *                 type: string
 *                 description: ID of the supervisor to revoke delegations from
 *               delegationIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of delegation IDs to be revoked
 *               confirmations:
 *                 type: object
 *                 properties:
 *                   revokeAgents:
 *                     type: boolean
 *                     description: Whether to revoke agents associated with the delegations (default: false)
 *                 description: Optional confirmations for cascading revocation
 *     responses:
 *       200:
 *         description: Delegations revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 supervisorID:
 *                   type: string
 *                   description: ID of the supervisor
 *                 delegationIDs:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of revoked delegation IDs
 *                 message:
 *                   type: string
 *                   description: Success message
 *                 cascadeApplied:
 *                   type: object
 *                   properties:
 *                     agents:
 *                       type: boolean
 *                       description: Whether agents were revoked
 *                   description: Indicates which associations were revoked
 *                 affectedCounts:
 *                   type: object
 *                   properties:
 *                     agents:
 *                       type: integer
 *                       description: Number of agents affected
 *                   description: Counts of affected associations
 *       400:
 *         description: Missing required fields or confirmation required for cascading revocation
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Supervisor or delegation not found
 *       500:
 *         description: Internal server error
 */
router.post('/revoke-delegations', requirePermission('revoke_delegations'), UserController.revokeDelegationsFromSupervisor);

/**
 * @swagger
 * /api/users/region/{regionID}/users:
 *   get:
 *     summary: Get users by region
 *     description: Retrieves a list of users assigned to a specific region. Requires 'access_users_by_region' permission. Results are cached.
 *     tags: [User Hierarchy]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: regionID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the region to fetch users from
 *     responses:
 *       200:
 *         description: List of users in the region
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required field 'regionID'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Region not found or no users assigned
 *       500:
 *         description: Internal server error
 */
router.get('/region/:regionID/users', requirePermission('access_users_by_region'), UserController.getUsersByRegion);

/**
 * @swagger
 * /api/users/governorate/{governorateID}/users:
 *   get:
 *     summary: Get users by governorate
 *     description: Retrieves a list of users assigned to a specific governorate. Requires 'access_users_by_governorate' permission. Results are cached.
 *     tags: [User Hierarchy]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: governorateID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the governorate to fetch users from
 *     responses:
 *       200:
 *         description: List of users in the governorate
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required field 'governorateID'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Governorate not found or no users assigned
 *       500:
 *         description: Internal server error
 */
router.get('/governorate/:governorateID/users', requirePermission('access_users_by_governorate'), UserController.getUsersByGovernorate);

/**
 * @swagger
 * /api/users/delegation/{delegationID}/users:
 *   get:
 *     summary: Get users by delegation
 *     description: Retrieves a list of users assigned to a specific delegation. Requires 'access_users_by_delegation' permission. Results are cached.
 *     tags: [User Hierarchy]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: delegationID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the delegation to fetch users from
 *     responses:
 *       200:
 *         description: List of users in the delegation
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required field 'delegationID'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Delegation not found or no users assigned
 *       500:
 *         description: Internal server error
 */
router.get('/delegation/:delegationID/users', requirePermission('access_users_by_delegation'), UserController.getUsersByDelegation);

/**
 * @swagger
 * /api/users/regional-manager/{regionalManagerID}/supervisors:
 *   get:
 *     summary: Get supervisors by regional manager
 *     description: Retrieves a list of supervisors assigned to a specific regional manager. Requires 'access_supervisors_by_regional_manager' permission. Results are cached.
 *     tags: [User Hierarchy]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: regionalManagerID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the regional manager to fetch supervisors for
 *     responses:
 *       200:
 *         description: List of supervisors
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required field 'regionalManagerID'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Regional manager not found or no supervisors assigned
 *       500:
 *         description: Internal server error
 */
router.get('/regional-manager/:regionalManagerID/supervisors', requirePermission('access_supervisors_by_regional_manager'), UserController.getSupervisorsByRegionalManager);

/**
 * @swagger
 * /api/users/director/{directorID}/regional-managers:
 *   get:
 *     summary: Get regional managers by director
 *     description: Retrieves a list of regional managers assigned to a specific director. Requires 'access_regional_managers_by_director' permission. Results are cached.
 *     tags: [User Hierarchy]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: directorID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the director to fetch regional managers for
 *     responses:
 *       200:
 *         description: List of regional managers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required field 'directorID'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Director not found or no regional managers assigned
 *       500:
 *         description: Internal server error
 */
router.get('/director/:directorID/regional-managers', requirePermission('access_regional_managers_by_director'), UserController.getRegionalManagersByDirector);

/**
 * @swagger
 * /api/users/regional-manager/{regionalManagerID}/director:
 *   get:
 *     summary: Get director by regional manager
 *     description: Retrieves the director assigned to a specific regional manager. Requires 'access_director_by_regional_manager' permission. Results are cached.
 *     tags: [User Hierarchy]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: regionalManagerID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the regional manager to fetch the director for
 *     responses:
 *       200:
 *         description: Director details (array with one item or empty if none assigned)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required field 'regionalManagerID'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Regional manager not found or no director assigned
 *       500:
 *         description: Internal server error
 */
router.get('/regional-manager/:regionalManagerID/director', requirePermission('access_director_by_regional_manager'), UserController.getDirectorByRegionalManager);

/**
 * @swagger
 * /api/users/supervisor/{supervisorID}/regional-manager:
 *   get:
 *     summary: Get regional manager by supervisor
 *     description: Retrieves the regional manager assigned to a specific supervisor. Requires 'access_regional_manager_by_supervisor' permission. Results are cached.
 *     tags: [User Hierarchy]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: supervisorID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the supervisor to fetch the regional manager for
 *     responses:
 *       200:
 *         description: Regional manager details (array with one item or empty if none assigned)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required field 'supervisorID'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Supervisor not found or no regional manager assigned
 *       500:
 *         description: Internal server error
 */
router.get('/supervisor/:supervisorID/regional-manager', requirePermission('access_regional_manager_by_supervisor'), UserController.getRegionalManagerBySupervisor);

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get current user's profile
 *     description: Retrieves the profile details of the currently authenticated user. No specific permission required beyond authentication. Results are cached.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User profile details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       500:
 *         description: Internal server error
 */
router.get('/profile', UserController.getProfile);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update current user's profile
 *     description: Updates the profile of the currently authenticated user, including an optional profile picture. No specific permission required beyond authentication. Triggers a notification and invalidates cache.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               PFP:
 *                 type: string
 *                 format: binary
 *                 description: Profile picture file (optional, must be an image)
 *               removePFP:
 *                 type: boolean
 *                 description: Set to true to remove the current profile picture (optional)
 *               email:
 *                 type: string
 *                 format: email
 *                 description: New email address (optional)
 *               phone:
 *                 type: string
 *                 pattern: '^\d{8,12}$'
 *                 description: New phone number (optional, 8-12 digits)
 *               firstname:
 *                 type: string
 *                 description: New first name (optional)
 *               lastname:
 *                 type: string
 *                 description: New last name (optional)
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input (e.g., invalid image format or missing fields)
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       500:
 *         description: Internal server error
 */
router.put('/profile', uploadPFP.single('PFP'), UserController.updateProfile);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     description: Retrieves a list of all users with their roles, regions, governorates, and delegations. Requires 'access_all_users' permission. Results are cached.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       500:
 *         description: Internal server error
 */
router.get('/', requirePermission('access_all_users'), UserController.getAllUsers);

/**
 * @swagger
 * /api/users/phone/{phone}:
 *   get:
 *     summary: Get user by phone number
 *     description: Retrieves a user by their phone number. Requires 'access_user_by_phone' permission. Results are cached.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: phone
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Phone number of the user to retrieve (8-12 digits)
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required field 'phone'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/phone/:phone', requirePermission('access_user_by_phone'), UserController.getUserByPhoneNumber);

/**
 * @swagger
 * /api/users/{userID}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieves detailed information about a specific user by their ID, including associated roles and hierarchy. Requires 'access_user_details' permission. Results are cached.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: userID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to retrieve
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required field 'userID'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/:userID', requirePermission('access_user_details'), UserController.getUserById);

/**
 * @swagger
 * /api/users/role/{role}:
 *   get:
 *     summary: Get users by role
 *     description: Retrieves a list of users with a specific role. Requires 'access_users_by_role' permission. Results are cached.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: role
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Role name to filter users by
 *     responses:
 *       200:
 *         description: List of users with the specified role
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required field 'role'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Role not found or no users with this role
 *       500:
 *         description: Internal server error
 */
router.get('/role/:role', requirePermission('access_users_by_role'), UserController.getUsersByRole);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     description: Creates a new user with the provided details. Requires 'create_users' permission. Triggers a welcome email, SMS notification, and invalidates cache.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstname
 *               - lastname
 *               - phone
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: User's password (minimum 6 characters)
 *               firstname:
 *                 type: string
 *                 pattern: '^[a-zA-Z]{2,50}$'
 *                 description: User's first name (2-50 letters)
 *               lastname:
 *                 type: string
 *                 pattern: '^[a-zA-Z]{2,50}$'
 *                 description: User's last name (2-50 letters)
 *               phone:
 *                 type: string
 *                 pattern: '^\d{8,12}$'
 *                 description: User's phone number (8-12 digits)
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required fields or invalid input (e.g., duplicate email/phone)
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       500:
 *         description: Internal server error
 */
router.post('/', requirePermission('create_users'), UserController.createUser);

/**
 * @swagger
 * /api/users/{userID}:
 *   put:
 *     summary: Update a user
 *     description: Updates an existing user's details, including an optional profile picture. Requires 'update_users' permission. Triggers a notification and invalidates cache.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: userID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to update
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               PFP:
 *                 type: string
 *                 format: binary
 *                 description: Profile picture file (optional, must be an image)
 *               email:
 *                 type: string
 *                 format: email
 *                 description: New email address (optional)
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: New password (optional, minimum 6 characters)
 *               firstname:
 *                 type: string
 *                 pattern: '^[a-zA-Z]{2,50}$'
 *                 description: New first name (optional, 2-50 letters)
 *               lastname:
 *                 type: string
 *                 pattern: '^[a-zA-Z]{2,50}$'
 *                 description: New last name (optional, 2-50 letters)
 *               phone:
 *                 type: string
 *                 pattern: '^\d{8,12}$'
 *                 description: New phone number (optional, 8-12 digits)
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input (e.g., invalid image format or duplicate email/phone)
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.put('/:userID', requirePermission('update_users'), uploadPFP.single('PFP'), UserController.updateUser);

/**
 * @swagger
 * /api/users/{userID}:
 *   delete:
 *     summary: Delete a user
 *     description: Deletes a user by their ID. Requires 'delete_users' permission. Triggers a notification and invalidates cache.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: userID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to delete
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *       400:
 *         description: Missing required field 'userID'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:userID', requirePermission('delete_users'), UserController.deleteUser);

/**
 * @swagger
 * /api/users/{userID}/supervisors:
 *   get:
 *     summary: Get supervisors of a user
 *     description: Retrieves a list of supervisors assigned to a specific user. Requires 'access_supervisors' permission. Results are cached.
 *     tags: [User Hierarchy]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: userID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to fetch supervisors for
 *     responses:
 *       200:
 *         description: List of supervisors
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required field 'userID'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *        similaire404:
 *         description: User not found or no supervisors assigned
 *       500:
 *         description: Internal server error
 */
router.get('/:userID/supervisors', requirePermission('access_supervisors'), UserController.getSupervisorsByUser);

/**
 * @swagger
 * /api/users/{userID}/regional-managers:
 *   get:
 *     summary: Get regional managers of a user
 *     description: Retrieves a list of regional managers assigned to a specific user (typically one). Requires 'access_regional_managers' permission. Results are cached.
 *     tags: [User Hierarchy]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: userID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to fetch regional managers for
 *     responses:
 *       200:
 *         description: List of regional managers (array with one item or empty if none assigned)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required field 'userID'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: User not found or no regional managers assigned
 *       500:
 *         description: Internal server error
 */
router.get('/:userID/regional-managers', requirePermission('access_regional_managers'), UserController.getRegionalManagersByUser);

/**
 * @swagger
 * /api/users/{userID}/director:
 *   get:
 *     summary: Get director of a user
 *     description: Retrieves the director assigned to a specific user. Requires 'access_director' permission. Results are cached.
 *     tags: [User Hierarchy]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: userID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to fetch the director for
 *     responses:
 *       200:
 *         description: Director details (array with one item or empty if none assigned)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required field 'userID'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: User not found or no director assigned
 *       500:
 *         description: Internal server error
 */
router.get('/:userID/director', requirePermission('access_director'), UserController.getDirectorByUser);

module.exports = router;