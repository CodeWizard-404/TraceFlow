const express = require('express');
const router = express.Router();
const { createTimesheet, viewTimesheet, validateTimesheet } = require('../controllers/timesheetController');

router.post('/create-timesheet', createTimesheet);
router.get('/view-timesheet/:timesheetID', viewTimesheet);
router.post('/validate-timesheet/:timesheetID', validateTimesheet);

module.exports = router;