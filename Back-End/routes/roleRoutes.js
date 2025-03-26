const express = require('express');
const router = express.Router();
const RoleController = require('../controllers/roleController');
const { authenticateJWT, requirePermission } = require('../config/security');


router.post('/', authenticateJWT, requirePermission('create_roles'), RoleController.createRole);
router.get('/', authenticateJWT, requirePermission('access_all_roles'), RoleController.getAllRoles);

router.get('/:roleID', authenticateJWT, requirePermission('read_role_details'), RoleController.getRoleById);
router.put('/:roleID', authenticateJWT, requirePermission('update_roles'), RoleController.updateRole);
router.delete('/:roleID', authenticateJWT, requirePermission('delete_roles'), RoleController.deleteRole);

router.post('/user/:userID/assign', authenticateJWT, requirePermission('assign_roles'), RoleController.assignRolesToUser);
router.post('/user/:userID/revoke', authenticateJWT, requirePermission('revoke_roles'), RoleController.revokeRolesFromUser);

router.get('/user/:userID', authenticateJWT, RoleController.getRolesByUser);


module.exports = router;