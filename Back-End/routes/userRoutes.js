const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authenticateJWT, requirePermission } = require('../config/security');


router.post('/', authenticateJWT, requirePermission('create_users'), UserController.createUser);
router.get('/', authenticateJWT, requirePermission('read_users'), UserController.getAllUsers);
router.get('/phone/:phone', authenticateJWT, requirePermission('read_user_by_phone'), UserController.getUserByPhoneNumber);
router.get('/:userID', authenticateJWT, requirePermission('read_user_details'), UserController.getUserById);
router.put('/:userID', authenticateJWT, requirePermission('update_users'), UserController.updateUser);
router.delete('/:userID', authenticateJWT, requirePermission('delete_users'), UserController.deleteUser);

router.get('/me/roles', authenticateJWT, UserController.getRolesByUser);

router.post('/assign-supervisors', authenticateJWT, requirePermission('assign_supervisors'), UserController.assignSupervisorsToManager);
router.get('/:userID/supervisors', authenticateJWT, requirePermission('read_supervisors'), UserController.getSupervisorsByUser);
router.get('/:userID/managers', authenticateJWT, requirePermission('read_managers'), UserController.getManagersByUser);

module.exports = router;