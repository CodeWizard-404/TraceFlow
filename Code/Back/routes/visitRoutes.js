const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const VisitController = require('../controllers/visitController');
const { uploadPhotos } = require('../config/multer');

// Routes for visits
router.post('/verify-qr', requirePermission('scan_visits'), VisitController.verifyQRCode);
router.put('/:id/log', requirePermission('log_visits'), uploadPhotos, VisitController.logVisit);
router.get('/:id', requirePermission('access_visit_details'), VisitController.getVisitByID);
router.put('/:id', requirePermission('edit_visit_details'), uploadPhotos, VisitController.updateVisit);
router.delete('/:id', requirePermission('delete_visit'), VisitController.deleteVisit);

// Google Calendar API routes
router.post('/:id/calendar/sync', requirePermission('access_google_calendar'), VisitController.syncVisitToCalendar);
router.post('/:id/calendar/sync/all', requirePermission('access_google_calendar'), VisitController.syncAllVisitsToCalendar);
router.put('/:id/calendar', requirePermission('access_google_calendar'), VisitController.updateCalendarEvent);
router.delete('/:id/calendar', requirePermission('access_google_calendar'), VisitController.deleteCalendarEvent);


module.exports = router;