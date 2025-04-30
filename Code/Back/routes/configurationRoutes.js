const express = require('express');
const router = express.Router();
const { authenticateCookie, requirePermission } = require('../config/security');
const ConfigurationController = require('../controllers/configurationController');

// Get all configurations
router.get(
    '/',
    requirePermission('manage_configurations'),
    ConfigurationController.getAllConfigurations
);

// Get a single configuration by key
router.get(
    '/:key',
    requirePermission('manage_configurations'),
    ConfigurationController.getConfigurationByKey
);

// Update a configuration
router.put(
    '/',
    requirePermission('manage_configurations'),
    ConfigurationController.updateConfiguration
);

module.exports = router;