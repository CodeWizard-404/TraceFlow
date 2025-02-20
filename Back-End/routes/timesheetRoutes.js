const express = require('express');
const router = express.Router();
const TimesheetController = require('../controllers/timesheetController');

router.post('/', TimesheetController.createTimesheet);
router.get('/', TimesheetController.getAllTimesheets);
router.get('/:id', TimesheetController.getTimesheetById);
router.put('/:id/validate', TimesheetController.validateTimesheet);

module.exports = router;