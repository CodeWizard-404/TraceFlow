const express = require('express');
const router = express.Router();
const RoleController = require('../controllers/roleController');
const { requirePermission } = require('../config/security');


router.post('/', requirePermission('create_roles'), RoleController.createRole);
router.get('/', requirePermission('access_all_roles'), RoleController.getAllRoles);

router.get('/:roleID', requirePermission('read_role_details'), RoleController.getRoleById);
router.put('/:roleID', requirePermission('update_roles'), RoleController.updateRole);
router.delete('/:roleID', requirePermission('delete_roles'), RoleController.deleteRole);

router.post('/user/:userID/assign', requirePermission('assign_roles'), RoleController.assignRolesToUser);
router.post('/user/:userID/revoke', requirePermission('revoke_roles'), RoleController.revokeRolesFromUser);

router.get('/user/:userID', RoleController.getRolesByUser);


module.exports = router;