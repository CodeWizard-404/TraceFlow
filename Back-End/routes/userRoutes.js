const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authenticateJWT, requirePermission } = require('../config/security');
const { uploadPFP } = require('../config/multer');

router.get('/', authenticateJWT, requirePermission('access_all_users'), UserController.getAllUsers);
router.get('/phone/:phone', authenticateJWT, requirePermission('access_user_by_phone'), UserController.getUserByPhoneNumber);
router.get('/:userID', authenticateJWT, requirePermission('access_user_details'), UserController.getUserById);
router.get('/role/:role', authenticateJWT, requirePermission('access_users_by_role'), UserController.getUsersByRole);

router.post('/', authenticateJWT, requirePermission('create_users'), UserController.createUser);
router.put('/profile', authenticateJWT, uploadPFP.single('PFP'), UserController.updateProfile);
router.put('/:userID', authenticateJWT, requirePermission('update_users'), uploadPFP.single('PFP'), UserController.updateUser);
router.delete('/:userID', authenticateJWT, requirePermission('delete_users'), UserController.deleteUser);

router.post('/assign-supervisors', authenticateJWT, requirePermission('assign_supervisors'), UserController.assignSupervisorsToManager);
router.post('/revoke-supervisors', authenticateJWT, requirePermission('revoke_supervisors'), UserController.revokeSupervisorsFromManager);

router.get('/:userID/supervisors', authenticateJWT, requirePermission('access_supervisors'), UserController.getSupervisorsByUser);
router.get('/:userID/managers', authenticateJWT, requirePermission('access_managers'), UserController.getManagersByUser);

module.exports = router;