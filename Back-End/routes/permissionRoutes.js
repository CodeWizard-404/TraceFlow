const express = require('express');
const router = express.Router();
const PermissionController = require('../controllers/permissionController');
const { authenticateJWT, requirePermission } = require('../config/security');



router.get('/', authenticateJWT, requirePermission('access_all_permissions'), PermissionController.getAllPermissions);
router.post('/', authenticateJWT, requirePermission('create_permissions'), PermissionController.createPermission);
router.put('/:permissionID', authenticateJWT, requirePermission('update_permissions'), PermissionController.updatePermission);
router.delete('/:permissionID', authenticateJWT, requirePermission('delete_permissions'), PermissionController.deletePermission);
router.get('/:permissionID', authenticateJWT, requirePermission('access_permission_details'), PermissionController.getPermissionById);

router.post('/role/:roleID/assign', authenticateJWT, requirePermission('assign_permissions'), PermissionController.assignPermissionsToRole);
router.post('/role/:roleID/revoke', authenticateJWT, requirePermission('revoke_permissions'), PermissionController.revokePermissionsFromRole);

router.get('/role/:roleID',authenticateJWT, requirePermission('access_permissions_by_role'), PermissionController.getPermissionsByRole);

router.post('/override/:userID', authenticateJWT, requirePermission('create_permission_overrides'), PermissionController.addPermissionOverride);
router.delete('/override/:overrideID', authenticateJWT, requirePermission('delete_permission_overrides'), PermissionController.removePermissionOverride);
router.get('/override/:userID', authenticateJWT, PermissionController.getPermissionOverrides);
router.get('/effective/:userID', authenticateJWT,  PermissionController.getEffectivePermissions);


module.exports = router;