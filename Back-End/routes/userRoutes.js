const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authenticateJWT, requirePermission } = require('../config/security');


router.post('/', authenticateJWT, requirePermission('create_users'), UserController.createUser);
router.get('/', authenticateJWT, requirePermission('read_users'), UserController.getAllUsers);
router.get('/:userID', authenticateJWT, requirePermission('read_user_details'), UserController.getUserById);
router.put('/:userID', authenticateJWT, requirePermission('update_users'), UserController.updateUser);
router.delete('/:userID', authenticateJWT, requirePermission('delete_users'), UserController.deleteUser);

router.post('/:userID/roles', authenticateJWT, requirePermission('assign_roles'), UserController.assignRolesToUser);
router.get('/:userID/roles', authenticateJWT, requirePermission('read_roles'), UserController.getRolesByUser);

module.exports = router;