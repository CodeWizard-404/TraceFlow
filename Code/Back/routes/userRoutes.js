const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { requirePermission } = require('../config/security');
const { uploadPFP } = require('../config/multer');



router.get('/:userID/supervisors', requirePermission('access_supervisors'), UserController.getSupervisorsByUser);
router.get('/:userID/regional-managers', requirePermission('access_regional_managers'), UserController.getRegionalManagersByUser);
router.get('/:userID/director', requirePermission('access_director'), UserController.getDirectorByUser);





router.post('/assign-regional-manager', requirePermission('assign_regional_manager'), UserController.assignRegionalManagerToSupervisor);
router.post('/revoke-regional-manager', requirePermission('revoke_regional_manager'), UserController.revokeRegionalManagerFromSupervisor);

router.post('/assign-director', requirePermission('assign_director'), UserController.assignDirectorToRegionalManager);
router.post('/revoke-director', requirePermission('revoke_director'), UserController.revokeDirectorFromRegionalManager);





router.post('/assign-regions', requirePermission('assign_regions'), UserController.assignRegionsToRegionalManager);
router.post('/revoke-regions', requirePermission('revoke_regions'), UserController.revokeRegionsFromRegionalManager);

router.post('/assign-governorates', requirePermission('assign_governorates'), UserController.assignGovernoratesToSupervisor);
router.post('/revoke-governorates', requirePermission('revoke_governorates'), UserController.revokeGovernoratesFromSupervisor);

router.post('/assign-delegations', requirePermission('assign_delegations'), UserController.assignDelegationsToSupervisor);
router.post('/revoke-delegations', requirePermission('revoke_delegations'), UserController.revokeDelegationsFromSupervisor);





router.post('/assign-supervisor-to-agent', requirePermission('assign_supervisor_to_agent'), UserController.assignSupervisorToAgent);
router.post('/revoke-supervisor-from-agent', requirePermission('revoke_supervisor_from_agent'), UserController.revokeSupervisorFromAgent);

router.post('/:userID/google-account', requirePermission('assign_google_account'), UserController.assignGoogleAccount);


router.get('/profile', UserController.getProfile);
router.put('/profile', uploadPFP.single('PFP'), UserController.updateProfile);

router.get('/', requirePermission('access_all_users'), UserController.getAllUsers);
router.get('/phone/:phone', requirePermission('access_user_by_phone'), UserController.getUserByPhoneNumber);
router.get('/:userID', requirePermission('access_user_details'), UserController.getUserById);
router.get('/role/:role', requirePermission('access_users_by_role'), UserController.getUsersByRole);

router.post('/', requirePermission('create_users'), UserController.createUser);
router.put('/:userID', requirePermission('update_users'), uploadPFP.single('PFP'), UserController.updateUser);
router.delete('/:userID', requirePermission('delete_users'), UserController.deleteUser);

module.exports = router;