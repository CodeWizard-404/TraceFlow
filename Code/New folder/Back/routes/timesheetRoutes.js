const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const TimesheetController = require('../controllers/timesheetController');

/**
 * @swagger
 * tags:
 *   name: Timesheets
 *   description: API endpoints for managing timesheets
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Timesheet:
 *       type: object
 *       properties:
 *         timesheetID:
 *           type: string
 *           description: Unique identifier for the timesheet
 *         weekNumber:
 *           type: integer
 *           description: Week number (1-53)
 *         year:
 *           type: integer
 *           description: Year (e.g., 2025)
 *         supervisorID:
 *           type: string
 *           description: ID of the supervisor associated with the timesheet
 *         status:
 *           type: string
 *           enum: [pending, visited, rejected, validated]
 *           description: Status of the timesheet
 *         Visits:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Visit'
 *           description: List of visits associated with the timesheet
 *         User:
 *           type: object
 *           properties:
 *             userID:
 *               type: string
 *               description: ID of the user (supervisor)
 *             email:
 *               type: string
 *               description: Email of the user
 *             regionalManagerID:
 *               type: string
 *               description: ID of the regional manager, if applicable
 *           description: Supervisor user details
 */

/**
 * @swagger
 * /timesheets/manager:
 *   post:
 *     summary: Create a timesheet for a manager
 *     tags: [Timesheets]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - weekNumber
 *               - year
 *               - supervisorID
 *             properties:
 *               weekNumber:
 *                 type: integer
 *                 description: Week number (1-53)
 *               year:
 *                 type: integer
 *                 description: Year (e.g., 2025)
 *               supervisorID:
 *                 type: string
 *                 description: ID of the supervisor
 *               visits:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     date:
 *                       type: string
 *                       format: date
 *                     time:
 *                       type: string
 *                     duration:
 *                       type: integer
 *                     location:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [pending, visited, rejected, validated]
 *                     agentID:
 *                       type: string
 *                 description: List of visits to associate with the timesheet
 *               status:
 *                 type: string
 *                 enum: [pending, visited, rejected, validated]
 *                 default: pending
 *                 description: Status of the timesheet
 *     responses:
 *       201:
 *         description: Timesheet created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timesheet:
 *                   $ref: '#/components/schemas/Timesheet'
 *                 warning:
 *                   type: string
 *                   nullable: true
 *                   description: Warning message if Google Calendar sync failed
 *       400:
 *         description: Missing required fields or invalid status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Please fill in all required fields."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'create_timesheets_for_supervisor' required"
 *       404:
 *         description: Supervisor not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid supervisor ID."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.post('/manager', requirePermission('create_timesheets_for_supervisor'), TimesheetController.createTimesheet);

/**
 * @swagger
 * /timesheets/supervisor:
 *   post:
 *     summary: Create a timesheet for a supervisor (self-creation)
 *     tags: [Timesheets]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - weekNumber
 *               - year
 *               - supervisorID
 *             properties:
 *               weekNumber:
 *                 type: integer
 *                 description: Week number (1-53)
 *               year:
 *                 type: integer
 *                 description: Year (e.g., 2025)
 *               supervisorID:
 *                 type: string
 *                 description: ID of the supervisor
 *               visits:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     date:
 *                       type: string
 *                       format: date
 *                     time:
 *                       type: string
 *                     duration:
 *                       type: integer
 *                     location:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [pending, visited, rejected, validated]
 *                     agentID:
 *                       type: string
 *                 description: List of visits to associate with the timesheet
 *               status:
 *                 type: string
 *                 enum: [pending, visited, rejected, validated]
 *                 default: pending
 *                 description: Status of the timesheet
 *     responses:
 *       201:
 *         description: Timesheet created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timesheet:
 *                   $ref: '#/components/schemas/Timesheet'
 *                 warning:
 *                   type: string
 *                   nullable: true
 *                   description: Warning message if Google Calendar sync failed
 *       400:
 *         description: Missing required fields or invalid status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Please fill in all required fields."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'create_self_timesheets' required"
 *       404:
 *         description: Supervisor not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid supervisor ID."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.post('/supervisor', requirePermission('create_self_timesheets'), TimesheetController.createTimesheet);

/**
 * @swagger
 * /timesheets/{id}/validate:
 *   put:
 *     summary: Validate a timesheet
 *     tags: [Timesheets]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the timesheet
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               visitIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: IDs of visits to validate
 *               status:
 *                 type: string
 *                 enum: [pending, visited, rejected, validated]
 *                 description: New status for the timesheet and specified visits
 *     responses:
 *       200:
 *         description: Timesheet validated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Timesheet'
 *       400:
 *         description: Missing required fields or invalid status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Please fill in all required fields."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'validate_timesheets' required"
 *       404:
 *         description: Timesheet or visits not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Timesheet not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.put('/:id/validate', requirePermission('validate_timesheets'), TimesheetController.validateTimesheet);

/**
 * @swagger
 * /timesheets:
 *   get:
 *     summary: Get all timesheets
 *     tags: [Timesheets]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of all timesheets
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Timesheet'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'access_all_timesheets' required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.get('/', requirePermission('access_all_timesheets'), TimesheetController.getAllTimesheets);

/**
 * @swagger
 * /timesheets/{id}:
 *   get:
 *     summary: Get a timesheet by ID
 *     tags: [Timesheets]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the timesheet
 *     responses:
 *       200:
 *         description: Timesheet details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Timesheet'
 *       400:
 *         description: Missing timesheet ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Please fill in all required fields."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'access_timesheet_details' required"
 *       404:
 *         description: Timesheet not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Timesheet not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.get('/:id', requirePermission('access_timesheet_details'), TimesheetController.getTimesheetById);

/**
 * @swagger
 * /timesheets/supervisor/{supervisorID}:
 *   get:
 *     summary: Get timesheets by supervisor ID
 *     tags: [Timesheets]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: supervisorID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the supervisor
 *     responses:
 *       200:
 *         description: List of timesheets for the supervisor
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Timesheet'
 *       400:
 *         description: Missing supervisor ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Please fill in all required fields."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'access_supervisor_timesheets' required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.get('/supervisor/:supervisorID', requirePermission('access_supervisor_timesheets'), TimesheetController.getTimesheetsBySupervisor);

/**
 * @swagger
 * /timesheets/week/{weekNumber}/year/{year}/supervisor/{supervisorID}:
 *   get:
 *     summary: Get a timesheet by week number, year, and supervisor ID
 *     tags: [Timesheets]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: weekNumber
 *         required: true
 *         schema:
 *           type: integer
 *         description: Week number (1-53)
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *         description: Year (e.g., 2025)
 *       - in: path
 *         name: supervisorID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the supervisor
 *     responses:
 *       200:
 *         description: Timesheet details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Timesheet'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Please fill in all required fields."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'access_timesheets_by_week_and_year' required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.get('/week/:weekNumber/year/:year/supervisor/:supervisorID', requirePermission('access_timesheets_by_week_and_year'), TimesheetController.getTimesheetByWeekNumberAndYear);

/**
 * @swagger
 * /timesheets/suggest:
 *   post:
 *     summary: Suggest a timesheet for a supervisor
 *     tags: [Timesheets]
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
 *               - weekNumber
 *               - year
 *               - coordinates
 *             properties:
 *               supervisorID:
 *                 type: string
 *                 description: ID of the supervisor
 *               weekNumber:
 *                 type: integer
 *                 description: Week number (1-53)
 *               year:
 *                 type: integer
 *                 description: Year (e.g., 2025)
 *               coordinates:
 *                 type: object
 *                 required:
 *                   - lat
 *                   - lng
 *                 properties:
 *                   lat:
 *                     type: number
 *                     description: Latitude
 *                   lng:
 *                     type: number
 *                     description: Longitude
 *               criteria:
 *                 type: object
 *                 properties:
 *                   delegationIds:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: List of delegation IDs
 *                   agentIds:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: List of agent IDs
 *                   preferredDays:
 *                     type: array
 *                     items:
 *                       type: string
 *                       format: date
 *                     description: Preferred days for visits
 *                   timeInterval:
 *                     type: object
 *                     properties:
 *                       startHour:
 *                         type: integer
 *                       endHour:
 *                         type: integer
 *                     description: Time interval for visits
 *                   maxVisitsPerAgentPerWeek:
 *                     type: integer
 *                     description: Maximum visits per agent per week
 *                   includeRecruitmentVisits:
 *                     type: boolean
 *                     description: Include recruitment visits
 *                   recruitmentAreas:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Recruitment areas
 *                   description:
 *                     type: string
 *                     description: Description of the timesheet
 *                   filters:
 *                     type: object
 *                     description: Additional filters
 *     responses:
 *       200:
 *         description: Suggested timesheet
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       visitID:
 *                         type: string
 *                       date:
 *                         type: string
 *                         format: date
 *                       time:
 *                         type: string
 *                       location:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [pending, visited, rejected, validated]
 *                       photos:
 *                         type: array
 *                         items:
 *                           type: string
 *                       comment:
 *                         type: string
 *                         nullable: true
 *                       agentID:
 *                         type: string
 *                         nullable: true
 *                       timesheetID:
 *                         type: string
 *                       calendarEventId:
 *                         type: string
 *                         nullable: true
 *                       Reasons:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             reasonID:
 *                               type: string
 *                             item:
 *                               type: string
 *                       Checklists:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             checklistID:
 *                               type: string
 *                             item:
 *                               type: string
 *                       Agent:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           agentID:
 *                             type: string
 *                           name:
 *                             type: string
 *                           lastname:
 *                             type: string
 *                           email:
 *                             type: string
 *                           phone:
 *                             type: string
 *                           location:
 *                             type: string
 *                           latitude:
 *                             type: number
 *                           longitude:
 *                             type: number
 *                           supervisorID:
 *                             type: string
 *                           delegationID:
 *                             type: string
 *                           Delegation:
 *                             type: object
 *                             properties:
 *                               delegationID:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                 requestId:
 *                   type: string
 *                   description: ID of the suggestion request
 *       400:
 *         description: Missing required fields or invalid coordinates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Valid coordinates (lat, lng) are required."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'suggest_timesheets' required"
 *       404:
 *         description: Supervisor not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid supervisor ID."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.post('/suggest', requirePermission('suggest_timesheets'), TimesheetController.suggestTimesheet);

/**
 * @swagger
 * /timesheets/{id}/sync-calendar:
 *   post:
 *     summary: Sync a timesheet to Google Calendar
 *     tags: [Timesheets]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the timesheet
 *     responses:
 *       200:
 *         description: Timesheet synced to calendar
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timesheetID:
 *                   type: string
 *                 syncedVisits:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       visitId:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [created, updated, failed]
 *                       error:
 *                         type: string
 *                         nullable: true
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'sync_timesheet_to_calendar' required"
 *       404:
 *         description: Timesheet or user not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Timesheet not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.post('/:id/sync-calendar', requirePermission('sync_timesheet_to_calendar'), TimesheetController.syncTimesheetToCalendar);

/**
 * @swagger
 * /timesheets/suggest/cancel/{requestId}:
 *   post:
 *     summary: Cancel a timesheet suggestion request
 *     tags: [Timesheets]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the suggestion request to cancel
 *     responses:
 *       200:
 *         description: Timesheet suggestion request canceled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Timesheet suggestion request canceled successfully"
 *       400:
 *         description: Missing request ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Please fill in all required fields."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'suggest_timesheets' required"
 *       404:
 *         description: No active suggestion request found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "No active suggestion request found for the provided ID"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Something broke. Try again later."
 */
router.post('/suggest/cancel/:requestId', requirePermission('suggest_timesheets'), TimesheetController.cancelTimesheetSuggestion);

module.exports = router;
