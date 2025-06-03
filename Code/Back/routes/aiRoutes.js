const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const AIController = require('../controllers/aiController');


router.post('/config', requirePermission('manage_ai_config'), AIController.createAIConfig);
router.put('/config/:configID', requirePermission('manage_ai_config'), AIController.updateAIConfig);
router.get('/config', requirePermission('manage_ai_config'), AIController.getAIConfig);
router.delete('/config/:configID', requirePermission('manage_ai_config'), AIController.deleteAIConfig);
router.get('/configs', requirePermission('manage_ai_config'), AIController.listAIConfigs);


router.post('/config/:configID/test', requirePermission('manage_ai_config'), AIController.testAIConfig);

module.exports = router;