const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { requirePermission } = require('../config/security');
const { uploadPFP } = require('../config/multer');

router.get('/profile', UserController.getProfile)
router.put('/profile', uploadPFP.single('PFP'), UserController.updateProfile);

router.get('/', requirePermission('access_all_users'), UserController.getAllUsers);
router.get('/phone/:phone', requirePermission('access_user_by_phone'), UserController.getUserByPhoneNumber);
router.get('/:userID', requirePermission('access_user_details'), UserController.getUserById);
router.get('/role/:role', requirePermission('access_users_by_role'), UserController.getUsersByRole);

router.post('/', requirePermission('create_users'), UserController.createUser);
router.put('/:userID', requirePermission('update_users'), uploadPFP.single('PFP'), UserController.updateUser);
router.delete('/:userID', requirePermission('delete_users'), UserController.deleteUser);

router.post('/assign-supervisors', requirePermission('assign_supervisors'), UserController.assignSupervisorsToManager);
router.post('/revoke-supervisors', requirePermission('revoke_supervisors'), UserController.revokeSupervisorsFromManager);

router.get('/:userID/supervisors', requirePermission('access_supervisors'), UserController.getSupervisorsByUser);
router.get('/:userID/managers', requirePermission('access_managers'), UserController.getManagersByUser);

module.exports = router;