const express = require('express');
const router = express.Router();
const RoleController = require('../controllers/roleController');
const { authenticateJWT, requirePermission } = require('../config/security');


router.post('/', authenticateJWT, requirePermission('create_roles'), RoleController.createRole);
router.get('/', authenticateJWT, requirePermission('read_roles'), RoleController.getAllRoles);
router.get('/:roleID', authenticateJWT, requirePermission('read_role_details'), RoleController.getRoleById);
router.put('/:roleID', authenticateJWT, requirePermission('update_roles'), RoleController.updateRole);
router.delete('/:roleID', authenticateJWT, requirePermission('delete_roles'), RoleController.deleteRole);

router.post('/:userID/roles', authenticateJWT, requirePermission('assign_roles'), RoleController.assignRolesToUser);
router.get('/:userID/roles', authenticateJWT, requirePermission('read_roles_by_user'), RoleController.getRolesByUser);


module.exports = router;