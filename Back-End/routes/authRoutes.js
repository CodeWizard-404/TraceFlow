const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateJWT, restrictTo } = require('../config/security');

router.post('/login', AuthController.login);
router.post('/verify-2fa', AuthController.verify2FA);
router.post('/users', AuthController.createUser);
router.get('/users',  AuthController.getAllUsers);
router.post('/roles',  AuthController.createRole);
router.get('/roles/:roleID',  AuthController.getRoleDetails);
router.put('/users/:userID/roles',AuthController.assignRolesToUser);

module.exports = router;