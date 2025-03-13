const express = require('express');
const router = express.Router();
const PermissionController = require('../controllers/permissionController');
const { authenticateJWT, requirePermission } = require('../config/security');

router.get('/', authenticateJWT, requirePermission('read_permissions'), PermissionController.getAllPermissions);
router.post('/', authenticateJWT, requirePermission('create_permissions'), PermissionController.createPermission);
router.put('/:permissionID', authenticateJWT, requirePermission('update_permissions'), PermissionController.updatePermission);
router.delete('/:permissionID', authenticateJWT, requirePermission('delete_permissions'), PermissionController.deletePermission);

router.get('/:permissionID', authenticateJWT, requirePermission('read_permissions'), PermissionController.getPermissionById);

module.exports = router;