const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const TimesheetController = require('../controllers/timesheetController');

router.post('/manager', requirePermission('create_timesheets_for_supervisor'), TimesheetController.createTimesheet);
router.post('/supervisor', requirePermission('create_self_timesheets'), TimesheetController.createTimesheet);
router.put('/:id/validate', requirePermission('validate_timesheets'), TimesheetController.validateTimesheet);
router.get('/', requirePermission('access_all_timesheets'), TimesheetController.getAllTimesheets);
router.get('/:id', requirePermission('access_timesheet_details'), TimesheetController.getTimesheetById);
router.get('/supervisor/:supervisorID', requirePermission('access_supervisor_timesheets'), TimesheetController.getTimesheetsBySupervisor);

module.exports = router;