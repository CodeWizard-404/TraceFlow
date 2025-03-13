const express = require('express');
const router = express.Router();
const RoleController = require('../controllers/roleController');
const { authenticateJWT, requirePermission } = require('../config/security');

router.post('/:roleID/permissions', authenticateJWT, requirePermission('assign_permissions'), RoleController.assignPermissionsToRole);
router.get('/:roleID/permissions',authenticateJWT, requirePermission('read_permissions'), RoleController.getPermissionsByRole);

router.post('/', authenticateJWT, requirePermission('create_roles'), RoleController.createRole);
router.get('/', authenticateJWT, requirePermission('read_roles'), RoleController.getAllRoles);
router.get('/:roleID', authenticateJWT, requirePermission('read_role_details'), RoleController.getRoleById);
router.put('/:roleID', authenticateJWT, requirePermission('update_roles'), RoleController.updateRole);
router.delete('/:roleID', authenticateJWT, requirePermission('delete_roles'), RoleController.deleteRole);


module.exports = router;