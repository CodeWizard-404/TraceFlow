const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateJWT, restrictTo } = require('../config/security');

router.post('/login', AuthController.login);
router.post('/verify-2fa', AuthController.verify2FA);
router.post('/users',authenticateJWT, restrictTo('Admin'), AuthController.createUser);
router.get('/users', authenticateJWT, restrictTo('Admin'), AuthController.getAllUsers);
router.post('/roles', authenticateJWT, restrictTo('Admin'), AuthController.createRole);
router.get('/roles/:roleID', authenticateJWT, restrictTo('Admin'), AuthController.getRoleDetails);
router.put('/users/:userID/roles', authenticateJWT, restrictTo('Admin'), AuthController.assignRolesToUser);

module.exports = router;