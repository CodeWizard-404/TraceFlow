const express = require('express');
const router = express.Router();
const { authenticateJWT, requirePermission } = require('../config/security');
const TimesheetController = require('../controllers/timesheetController');
const { uploadPhotos } = require('../config/multer');

router.post('/manager', authenticateJWT, requirePermission('create_timesheets_for_supervisor'), TimesheetController.createTimesheet);
router.post('/supervisor', authenticateJWT, requirePermission('create_self_timesheets'), TimesheetController.createTimesheet);
router.put('/:id/validate', authenticateJWT, requirePermission('validate_timesheets'), TimesheetController.validateTimesheet);
// router.put('/:id',
//     authenticateJWT,
//     requirePermission('edit_timesheets_for_supervisor'),
//     uploadPhotos.any(), // Accept any field names (e.g., "photos.vis_123")
//     TimesheetController.updateTimesheet
// );
// router.delete('/:id', authenticateJWT, requirePermission('delete_timesheets_for_supervisor'), TimesheetController.deleteTimesheet);

router.get('/', authenticateJWT, requirePermission('access_all_timesheets'), TimesheetController.getAllTimesheets);
router.get('/:id', authenticateJWT, requirePermission('access_timesheet_details'), TimesheetController.getTimesheetById);
router.get('/supervisor/:supervisorID', authenticateJWT, requirePermission('access_supervisor_timesheets'), TimesheetController.getTimesheetsBySupervisor);

module.exports = router;