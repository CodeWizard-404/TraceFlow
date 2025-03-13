const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateJWT, requirePermission } = require('../config/security');

router.post('/login', AuthController.login);
router.post('/verify-2fa', AuthController.verify2FA);

module.exports = router;