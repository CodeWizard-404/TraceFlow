const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const CsvHeaderController = require('../controllers/csvHeaderController');

router.get('/', requirePermission('view_csv_headers'), CsvHeaderController.getHeaders);
router.put('/', requirePermission('update_csv_headers'), CsvHeaderController.updateHeaders);

module.exports = router;