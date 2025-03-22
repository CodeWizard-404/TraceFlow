const express = require('express');
const router = express.Router();
const { authenticateJWT, requirePermission } = require('../config/security');
const TimesheetController = require('../controllers/timesheetController');


router.post('/', authenticateJWT, requirePermission('create_timesheets'), TimesheetController.createTimesheet);
router.post('/', authenticateJWT, requirePermission('create_timesheets_for_supervisor'), TimesheetController.createTimesheet);
router.get('/', authenticateJWT, requirePermission('access_timesheets'), TimesheetController.getAllTimesheets);
router.get('/:id', authenticateJWT, requirePermission('access_timesheet_details'), TimesheetController.getTimesheetById);
router.put('/:id/validate', authenticateJWT, requirePermission('validate_timesheets'), TimesheetController.validateTimesheet);
router.get('/supervisor/:supervisorID', authenticateJWT, requirePermission('access_Supervisor_timesheets'), TimesheetController.getTimesheetsBySupervisor);

module.exports = router;