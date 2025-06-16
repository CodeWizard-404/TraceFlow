const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const VisitController = require('../controllers/visitController');
const { uploadPhotos } = require('../config/multer');

/**
 * @swagger
 * tags:
 *   name: Visits
 *   description: API endpoints for managing visits
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Visit:
 *       type: object
 *       properties:
 *         visitID:
 *           type: string
 *           description: Unique identifier for the visit
 *         date:
 *           type: string
 *           format: date
 *           description: Date of the visit (YYYY-MM-DD)
 *         time:
 *           type: string
 *           description: Time of the visit (HH:MM)
 *         duration:
 *           type: integer
 *           description: Duration of the visit in minutes
 *         location:
 *           type: string
 *           description: Location of the visit
 *         status:
 *           type: string
 *           enum: [pending, visited, rejected, validated]
 *           description: Status of the visit
 *         comment:
 *           type: string
 *           description: Comment about the visit
 *         agentID:
 *           type: string
 *           description: ID of the agent assigned to the visit
 *         supervisorID:
 *           type: string
 *           description: ID of the supervisor for the visit
 *         checklists:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               checklistID:
 *                 type: string
 *               checked:
 *                 type: boolean
 *           description: Checklists associated with the visit
 *         reasons:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               reasonID:
 *                 type: string
 *           description: Reasons associated with the visit
 *         photos:
 *           type: array
 *           items:
 *             type: string
 *           description: Paths to photos uploaded for the visit
 */

/**
 * @swagger
 * /visits/verify-qr:
 *   post:
 *     summary: Verify a QR code for a visit
 *     tags: [Visits]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - qrData
 *               - visitId
 *             properties:
 *               qrData:
 *                 type: string
 *                 description: The QR code data to verify
 *               visitId:
 *                 type: string
 *                 description: The ID of the visit
 *     responses:
 *       200:
 *         description: QR code verification result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 otpID:
 *                   type: string
 *                   description: OTP ID if verification is successful
 *       400:
 *         description: Missing required fields or invalid QR code
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing required fields"
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
 *                   example: "Permission 'scan_visits' required"
 *       404:
 *         description: Visit not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Visit not found"
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
router.post('/verify-qr', requirePermission('scan_visits'), VisitController.verifyQRCode);

/**
 * @swagger
 * /visits/{id}/validate-otp:
 *   post:
 *     summary: Validate an OTP for a visit
 *     tags: [Visits]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the visit
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - visitId
 *               - otpCode
 *             properties:
 *               visitId:
 *                 type: string
 *                 description: The ID of the visit
 *               otpCode:
 *                 type: string
 *                 description: The OTP code to validate
 *     responses:
 *       200:
 *         description: OTP validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing required fields"
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
 *                   example: "Permission 'scan_visits' required"
 *       404:
 *         description: Visit not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Visit not found"
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
router.post('/:id/validate-otp', requirePermission('scan_visits'), VisitController.validateOTP);

/**
 * @swagger
 * /visits/{id}/log:
 *   put:
 *     summary: Log a visit with details and photos
 *     tags: [Visits]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the visit
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               duration:
 *                 type: integer
 *                 description: Duration of the visit in minutes (optional)
 *               checklistUpdates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     checklistID:
 *                       type: string
 *                     checked:
 *                       type: boolean
 *                 description: Updates to checklists (optional)
 *               comment:
 *                 type: string
 *                 description: Comment about the visit (optional)
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Date of the visit (YYYY-MM-DD, optional)
 *               time:
 *                 type: string
 *                 description: Time of the visit (HH:MM, optional)
 *               status:
 *                 type: string
 *                 enum: [pending, visited, rejected, validated]
 *                 description: Status of the visit (optional, defaults to 'visited')
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Photos to upload (at least one required)
 *     responses:
 *       200:
 *         description: Logged visit details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Visit'
 *       400:
 *         description: Missing required fields or no photos uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "At least one photo is required"
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
 *                   example: "Permission 'log_visits' required"
 *       404:
 *         description: Visit not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Visit not found"
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
router.put('/:id/log', requirePermission('log_visits'), uploadPhotos, VisitController.logVisit);

/**
 * @swagger
 * /visits/{id}:
 *   get:
 *     summary: Get details of a visit by ID
 *     tags: [Visits]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the visit
 *     responses:
 *       200:
 *         description: Visit details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Visit'
 *       400:
 *         description: Missing visit ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Visit ID is required"
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
 *                   example: "Permission 'access_visit_details' required"
 *       404:
 *         description: Visit not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Visit not found"
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
router.get('/:id', requirePermission('access_visit_details'), VisitController.getVisitByID);

/**
 * @swagger
 * /visits/{id}:
 *   put:
 *     summary: Update a visit's details
 *     tags: [Visits]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the visit
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Date of the visit (YYYY-MM-DD, optional)
 *               time:
 *                 type: string
 *                 description: Time of the visit (HH:MM, optional)
 *               duration:
 *                 type: integer
 *                 description: Duration of the visit in minutes (optional)
 *               location:
 *                 type: string
 *                 description: Location of the visit (optional)
 *               status:
 *                 type: string
 *                 enum: [pending, visited, rejected, validated]
 *                 description: Status of the visit (optional)
 *               comment:
 *                 type: string
 *                 description: Comment about the visit (optional)
 *               agentID:
 *                 type: string
 *                 description: ID of the agent (optional)
 *               checklists:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     checked:
 *                       type: boolean
 *                 description: Checklist updates (optional)
 *               reasons:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                 description: Reason updates (optional)
 *               photosToRemove:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Paths of photos to remove (optional)
 *               supervisorID:
 *                 type: string
 *                 description: ID of the supervisor (optional)
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Photos to upload (optional)
 *     responses:
 *       200:
 *         description: Updated visit details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Visit'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid input"
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
 *                   example: "Permission 'edit_visit_details' required"
 *       404:
 *         description: Visit or related resources not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Visit not found"
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
router.put('/:id', requirePermission('edit_visit_details'), uploadPhotos, VisitController.updateVisit);

/**
 * @swagger
 * /visits/{id}:
 *   delete:
 *     summary: Delete a visit
 *     tags: [Visits]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the visit
 *     responses:
 *       200:
 *         description: Visit deletion confirmation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 warning:
 *                   type: string
 *                   nullable: true
 *       400:
 *         description: Missing visit ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Visit ID is required"
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
 *                   example: "Permission 'delete_visit' required"
 *       404:
 *         description: Visit not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Visit not found"
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
router.delete('/:id', requirePermission('delete_visit'), VisitController.deleteVisit);

/**
 * @swagger
 * /visits/{visitId}/sync-calendar:
 *   post:
 *     summary: Sync a visit to Google Calendar
 *     tags: [Visits]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: visitId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the visit
 *     responses:
 *       200:
 *         description: Visit synced to calendar
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 visitID:
 *                   type: string
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie or invalid Google Calendar credentials
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
 *                   example: "Permission 'sync_visits_to_calendar' required"
 *       404:
 *         description: Visit, timesheet, or user not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Visit not found"
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
router.post('/:visitId/sync-calendar', requirePermission('sync_visits_to_calendar'), VisitController.syncVisitToCalendar);

/**
 * @swagger
 * /visits/timesheet/{timesheetId}/calendar-events:
 *   get:
 *     summary: List calendar events for a timesheet
 *     tags: [Visits]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: timesheetId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the timesheet
 *     responses:
 *       200:
 *         description: List of calendar events
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   summary:
 *                     type: string
 *                   start:
 *                     type: object
 *                     properties:
 *                       dateTime:
 *                         type: string
 *                         format: date-time
 *                   end:
 *                     type: object
 *                     properties:
 *                       dateTime:
 *                         type: string
 *                         format: date-time
 *                   location:
 *                     type: string
 *                   description:
 *                     type: string
 *       400:
 *         description: Missing timesheet ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Timesheet ID is required"
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
 *                   example: "Permission 'access_calendar_events' required"
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
router.get('/timesheet/:timesheetId/calendar-events', requirePermission('access_calendar_events'), VisitController.listCalendarEvents);

module.exports = router;