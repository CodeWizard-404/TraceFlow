const express = require('express');
const router = express.Router();
const PermissionController = require('../controllers/permissionController');
const { authenticateJWT, requirePermission } = require('../config/security');



router.get('/', authenticateJWT, requirePermission('read_permissions'), PermissionController.getAllPermissions);
router.post('/', authenticateJWT, requirePermission('create_permissions'), PermissionController.createPermission);
router.put('/:permissionID', authenticateJWT, requirePermission('update_permissions'), PermissionController.updatePermission);
router.delete('/:permissionID', authenticateJWT, requirePermission('delete_permissions'), PermissionController.deletePermission);
router.get('/:permissionID', authenticateJWT, requirePermission('read_permission_details'), PermissionController.getPermissionById);

router.post('/:roleID/permissions', authenticateJWT, requirePermission('assign_permissions'), PermissionController.assignPermissionsToRole);
router.get('/:roleID/permissions',authenticateJWT, requirePermission('read_permissions_by_role'), PermissionController.getPermissionsByRole);

router.post('/override/:userID', authenticateJWT, requirePermission('manage_permission_overrides'), PermissionController.addPermissionOverride);
router.delete('/override/:overrideID', authenticateJWT, requirePermission('manage_permission_overrides'), PermissionController.removePermissionOverride);
router.get('/effective/:userID', authenticateJWT, requirePermission('read_effective_permissions'), PermissionController.getEffectivePermissions);


module.exports = router;