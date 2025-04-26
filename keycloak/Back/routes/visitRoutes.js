const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const VisitController = require('../controllers/visitController');
const { uploadPhotos } = require('../config/multer');

router.post('/verify-qr', requirePermission('scan_visits'), VisitController.verifyQRCode);
router.put('/:id/log', requirePermission('log_visits'), uploadPhotos, VisitController.logVisit);
router.get('/:id', requirePermission('access_visit_details'), VisitController.getVisitByID);
router.put('/:id', requirePermission('edit_visit_details'), uploadPhotos, VisitController.updateVisit);
router.delete('/:id', requirePermission('delete_visit'), VisitController.deleteVisit);

module.exports = router;