const express = require('express');
const router = express.Router();
const PermissionController = require('../controllers/permissionController');
const { requirePermission } = require('../config/security');



router.get('/', requirePermission('access_all_permissions'), PermissionController.getAllPermissions);
router.post('/', requirePermission('create_permissions'), PermissionController.createPermission);
router.put('/:permissionID', requirePermission('update_permissions'), PermissionController.updatePermission);
router.delete('/:permissionID', requirePermission('delete_permissions'), PermissionController.deletePermission);
router.get('/:permissionID', requirePermission('access_permission_details'), PermissionController.getPermissionById);

router.post('/role/:roleID/assign', requirePermission('assign_permissions'), PermissionController.assignPermissionsToRole);
router.post('/role/:roleID/revoke', requirePermission('revoke_permissions'), PermissionController.revokePermissionsFromRole);

router.get('/role/:roleID', requirePermission('access_permissions_by_role'), PermissionController.getPermissionsByRole);

router.post('/override/:userID', requirePermission('create_permission_overrides'), PermissionController.addPermissionOverride);
router.delete('/override/:overrideID', requirePermission('delete_permission_overrides'), PermissionController.removePermissionOverride);
router.get('/override/:userID', PermissionController.getPermissionOverrides);
router.get('/effective/:userID', PermissionController.getEffectivePermissions);


module.exports = router;