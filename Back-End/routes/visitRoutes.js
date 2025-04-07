const express = require('express');
const router = express.Router();
const { authenticateJWT, requirePermission } = require('../config/security');
const VisitController = require('../controllers/visitController');
const { uploadPhotos } = require('../config/multer');

router.post('/verify-qr', authenticateJWT, requirePermission('scan_visits'), VisitController.verifyQRCode);
router.put('/:id/log', authenticateJWT, requirePermission('log_visits'), uploadPhotos.array('photos'), VisitController.logVisit);
router.get('/:id', authenticateJWT, requirePermission('access_visit_details'), VisitController.getVisitByID);
router.put('/:id', authenticateJWT, requirePermission('edit_visit_details'), uploadPhotos.array('photos'), VisitController.updateVisit);
router.delete('/:id', authenticateJWT, requirePermission('delete_visit'), VisitController.deleteVisit);

module.exports = router;