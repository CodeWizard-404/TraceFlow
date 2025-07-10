const express = require('express');
const router = express.Router();
const RoleController = require('../controllers/roleController');
const { requirePermission } = require('../config/security');

/**
 * @swagger
 * /api/roles/reset:
 *   post:
 *     summary: Reset main roles to default configuration
 *     description: Resets predefined roles (e.g., Super Admin, Admin) to their default permissions and settings. Triggers a `role:reset` notification.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Main roles reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Main roles reset successfully
 *                 details:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       roleName:
 *                         type: string
 *                       permissionsAssigned:
 *                         type: integer
 *                       permissionsRevoked:
 *                         type: integer
 *                       totalPermissions:
 *                         type: integer
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized, missing or invalid token
 *       500:
 *         description: Internal server error
 */
router.post('/reset', requirePermission('reset_roles'), RoleController.resetMainRoles);

/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Create a new role
 *     description: Creates a new role with the specified name and description. Triggers a `role:created` notification.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: The unique name of the role
 *                 example: Manager
 *               description:
 *                 type: string
 *                 description: Optional description of the role
 *                 example: Manages regional operations
 *     responses:
 *       201:
 *         description: Role created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 roleID:
 *                   type: string
 *                 name:
 *                   type: string
 *                 description:
 *                   type: string
 *       400:
 *         description: Missing required fields or role already exists
 *       401:
 *         description: Unauthorized, missing or invalid token
 *       500:
 *         description: Internal server error
 */
router.post('/', requirePermission('create_roles'), RoleController.createRole);

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: Get all roles
 *     description: Retrieves a list of all roles with their permissions.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all roles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   roleID:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   Permissions:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         permissionID:
 *                           type: string
 *                         name:
 *                           type: string
 *                         description:
 *                           type: string
 *       401:
 *         description: Unauthorized, missing or invalid token
 *       500:
 *         description: Internal server error
 */
router.get('/', requirePermission('access_all_roles'), RoleController.getAllRoles);

/**
 * @swagger
 * /api/roles/{roleID}:
 *   get:
 *     summary: Get a role by ID
 *     description: Retrieves details of a specific role by its ID, including associated permissions.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the role to retrieve
 *     responses:
 *       200:
 *         description: Role details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 roleID:
 *                   type: string
 *                 name:
 *                   type: string
 *                 description:
 *                   type: string
 *                 Permissions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *       400:
 *         description: Missing roleID
 *       401:
 *         description: Unauthorized, missing or invalid token
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error
 */
router.get('/:roleID', requirePermission('read_role_details'), RoleController.getRoleById);

/**
 * @swagger
 * /api/roles/{roleID}:
 *   put:
 *     summary: Update a role
 *     description: Updates the name and/or description of a role. Restricted roles cannot be renamed. Triggers a `role:updated` notification.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the role to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The new name of the role
 *                 example: UpdatedManager
 *               description:
 *                 type: string
 *                 description: The new description of the role
 *                 example: Updated description for manager role
 *     responses:
 *       200:
 *         description: Role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 roleID:
 *                   type: string
 *                 name:
 *                   type: string
 *                 description:
 *                   type: string
 *       400:
 *         description: Missing roleID or restricted role rename attempted
 *       401:
 *         description: Unauthorized, missing or invalid token
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error
 */
router.put('/:roleID', requirePermission('update_roles'), RoleController.updateRole);

/**
 * @swagger
 * /api/roles/{roleID}:
 *   delete:
 *     summary: Delete a role
 *     description: Deletes a role by its ID. Restricted roles cannot be deleted. Triggers a `role:deleted` notification.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the role to delete
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Role deleted successfully
 *       400:
 *         description: Missing roleID or restricted role deletion attempted
 *       401:
 *         description: Unauthorized, missing or invalid token
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:roleID', requirePermission('delete_roles'), RoleController.deleteRole);

/**
 * @swagger
 * /api/roles/user/{userID}/assign:
 *   post:
 *     summary: Assign roles to a user
 *     description: Assigns one or more roles to a user. Triggers a `role:assigned` notification.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to assign roles to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleIDs
 *             properties:
 *               roleIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of role IDs to assign
 *                 example: ["role1", "role2"]
 *     responses:
 *       201:
 *         description: Roles assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userID:
 *                   type: string
 *                 roleIDs:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Missing userID or invalid/empty roleIDs
 *       401:
 *         description: Unauthorized, missing or invalid token
 *       404:
 *         description: User or roles not found
 *       500:
 *         description: Internal server error
 */
router.post('/user/:userID/assign', requirePermission('assign_roles'), RoleController.assignRolesToUser);

/**
 * @swagger
 * /api/roles/user/{userID}/revoke:
 *   post:
 *     summary: Revoke roles from a user
 *     description: Revokes one or more roles from a user. Triggers a `role:revoked` notification.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to revoke roles from
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleIDs
 *             properties:
 *               roleIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of role IDs to revoke
 *                 example: ["role1", "role2"]
 *     responses:
 *       200:
 *         description: Roles revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userID:
 *                   type: string
 *                 roleIDs:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Missing userID or invalid/empty roleIDs
 *       401:
 *         description: Unauthorized, missing or invalid token
 *       404:
 *         description: User or roles not found
 *       500:
 *         description: Internal server error
 */
router.post('/user/:userID/revoke', requirePermission('revoke_roles'), RoleController.revokeRolesFromUser);

/**
 * @swagger
 * /api/roles/user/{userID}:
 *   get:
 *     summary: Get roles for a user
 *     description: Retrieves all roles assigned to a specific user, including their permissions.
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: userID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user whose roles to retrieve
 *     responses:
 *       200:
 *         description: List of roles for the user
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   roleID:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   Permissions:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         description:
 *                           type: string
 *       400:
 *         description: Missing userID
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/user/:userID', RoleController.getRolesByUser);

module.exports = router;