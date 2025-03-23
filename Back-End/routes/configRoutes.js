// routes/configRoutes.js
const express = require('express');
const ConfigController = require('../controllers/configController');
const { authenticateJWT, requirePermission } = require('../config/security');

const router = express.Router();

router.get('/', 
    authenticateJWT, 
    requirePermission('read_config'),
    ConfigController.getConfig
);

module.exports = router;