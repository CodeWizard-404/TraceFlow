const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { requirePermission } = require('../config/security');
const { uploadPFP } = require('../config/multer');

// User hierarchy retrieval routes
router.get('/:userID/supervisors', requirePermission('access_supervisors'), UserController.getSupervisorsByUser);
router.get('/:userID/regional-managers', requirePermission('access_regional_managers'), UserController.getRegionalManagersByUser);
router.get('/:userID/director', requirePermission('access_director'), UserController.getDirectorByUser);





// Assignment and revocation routes
router.post('/assign-regional-manager', requirePermission('assign_regional_manager'), UserController.assignRegionalManagerToSupervisor);
router.post('/revoke-regional-manager', requirePermission('revoke_regional_manager'), UserController.revokeRegionalManagerFromSupervisor);

router.post('/assign-director', requirePermission('assign_director'), UserController.assignDirectorToRegionalManager);
router.post('/revoke-director', requirePermission('revoke_director'), UserController.revokeDirectorFromRegionalManager);

router.post('/assign-supervisor-to-agent', requirePermission('assign_supervisor_to_agent'), UserController.assignSupervisorToAgent);
router.post('/revoke-supervisor-from-agent', requirePermission('revoke_supervisor_from_agent'), UserController.revokeSupervisorFromAgent);





// Assignment and revocation routes for regions, governorates, and delegations
router.post('/assign-regions', requirePermission('assign_regions'), UserController.assignRegionsToRegionalManager);
router.post('/revoke-regions', requirePermission('revoke_regions'), UserController.revokeRegionsFromRegionalManager);

router.post('/assign-governorates', requirePermission('assign_governorates'), UserController.assignGovernoratesToSupervisor);
router.post('/revoke-governorates', requirePermission('revoke_governorates'), UserController.revokeGovernoratesFromSupervisor);

router.post('/assign-delegations', requirePermission('assign_delegations'), UserController.assignDelegationsToSupervisor);
router.post('/revoke-delegations', requirePermission('revoke_delegations'), UserController.revokeDelegationsFromSupervisor);






// Users fetching routes
router.get('/region/:regionID/users', requirePermission('access_users_by_region'), UserController.getUsersByRegion);
router.get('/governorate/:governorateID/users', requirePermission('access_users_by_governorate'), UserController.getUsersByGovernorate);
router.get('/delegation/:delegationID/users', requirePermission('access_users_by_delegation'), UserController.getUsersByDelegation);

router.get('/regional-manager/:regionalManagerID/supervisors', requirePermission('access_supervisors_by_regional_manager'), UserController.getSupervisorsByRegionalManager);
router.get('/director/:directorID/regional-managers', requirePermission('access_regional_managers_by_director'), UserController.getRegionalManagersByDirector);
router.get('/regional-manager/:regionalManagerID/director', requirePermission('access_director_by_regional_manager'), UserController.getDirectorByRegionalManager);
router.get('/supervisor/:supervisorID/regional-manager', requirePermission('access_regional_manager_by_supervisor'), UserController.getRegionalManagerBySupervisor);



// Profile management routes
router.get('/profile', UserController.getProfile);
router.put('/profile', uploadPFP.single('PFP'), UserController.updateProfile);

// CRUD routes for users
router.get('/', requirePermission('access_all_users'), UserController.getAllUsers);
router.get('/phone/:phone', requirePermission('access_user_by_phone'), UserController.getUserByPhoneNumber);
router.get('/:userID', requirePermission('access_user_details'), UserController.getUserById);
router.get('/role/:role', requirePermission('access_users_by_role'), UserController.getUsersByRole);
router.post('/', requirePermission('create_users'), UserController.createUser);
router.put('/:userID', requirePermission('update_users'), uploadPFP.single('PFP'), UserController.updateUser);
router.delete('/:userID', requirePermission('delete_users'), UserController.deleteUser);

module.exports = router;