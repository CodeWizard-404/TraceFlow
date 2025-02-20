const express = require('express');
const router = express.Router();
const TimesheetController = require('../controllers/timesheetController');

// Create a new timesheet or add visits to an existing one
router.post('/timesheets', TimesheetController.createTimesheet);

// View all timesheets (for managers or HR)
router.get('/timesheets', TimesheetController.getAllTimesheets);

// View a specific timesheet by ID
router.get('/timesheets/:id', TimesheetController.getTimesheetById);

// Validate a timesheet (fully or partially)
router.put('/timesheets/:id/validate', TimesheetController.validateTimesheet);

module.exports = router;