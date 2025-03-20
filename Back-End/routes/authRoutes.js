const express = require('express');
const router = express.Router();
//const { keycloak } = require('../config/security'); // Import keycloak instance
const AuthController = require('../controllers/authController');

router.post('/login', AuthController.login);
router.post('/verify-2fa', AuthController.verify2FA);


module.exports = router;