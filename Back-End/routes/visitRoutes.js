const express = require('express');
const router = express.Router();
const { logVisit, validateChecklist } = require('../controllers/visitController');

router.post('/log-visit', logVisit);
router.post('/validate-checklist/:visitID', validateChecklist);

module.exports = router;