const express = require('express');
const router = express.Router();
const PermissionController = require('../controllers/permissionController');
const { requirePermission } = require('../config/security');

/**
 * @swagger
 * tags:
 *   name: Permissions
 *   description: API endpoints for managing permissions
 *   name: Roles
 *   description: API endpoints for managing roles and their permissions
 */

/**
 * @swagger
 * /permissions:
 *   get:
 *     summary: Retrieve all permissions
 *     tags: [Permissions]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of all permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   permissionID:
 *                     type: string
 *                     description: Unique identifier for the permission
 *                   name:
 *                     type: string
 *                     description: Name of the permission
 *                   class:
 *                     type: string
 *                     description: Class or category of the permission
 *                   description:
 *                     type: string
 *                     description: Description of the permission
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'access_all_permissions' required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch permissions"
 */
router.get('/', requirePermission('access_all_permissions'), PermissionController.getAllPermissions);

/**
 * @swagger
 * /permissions/{permissionID}:
 *   put:
 *     summary: Update a permission by ID
 *     tags: [Permissions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: permissionID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the permission to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               className:
 *                 type: string
 *                 description: The updated class or category of the permission
 *                 example: "Role"
 *               description:
 *                 type: string
 *                 description: The updated description of the permission
 *                 example: "Updated permission description"
 *     responses:
 *       200:
 *         description: Permission updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 permissionID:
 *                   type: string
 *                   description: Unique identifier for the permission
 *                 name:
 *                   type: string
 *                   description: Name of the permission
 *                 class:
 *                   type: string
 *                   description: Class or category of the permission
 *                 description:
 *                   type: string
 *                   description: Description of the permission
 *       400:
 *         description: Permission ID is required or invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission ID is required"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'update_permissions' required"
 *       404:
 *         description: Permission not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission not found"
 */
router.put('/:permissionID', requirePermission('update_permissions'), PermissionController.updatePermission);

/**
 * @swagger
 * /permissions/{permissionID}:
 *   get:
 *     summary: Retrieve a permission by ID
 *     tags: [Permissions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: permissionID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the permission to retrieve
 *     responses:
 *       200:
 *         description: Permission retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 permissionID:
 *                     type: string
 *                     description: Unique identifier for the permission
 *                 name:
 *                     type: string
 *                     description: Name of the permission
 *                 class:
 *                     type: string
 *                     description: Class or category of the permission
 *                 description:
 *                     type: string
 *                     description: Description of the permission
 *                 Roles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       roleID:
 *                         type: string
 *                         description: Unique identifier for the role
 *                       name:
 *                         type: string
 *                         description: Name of the role
 *       400:
 *         description: Permission ID is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission ID is required"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'access_permission_details' required"
 *       404:
 *         description: Permission not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission not found"
 */
router.get('/:permissionID', requirePermission('access_permission_details'), PermissionController.getPermissionById);

/**
 * @swagger
 * /permissions/role/{roleID}/assign:
 *   post:
 *     summary: Assign permissions to a role
 *     tags: [Permissions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: roleID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the role to assign permissions to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - permissionIDs
 *             properties:
 *               permissionIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of permission IDs to assign to the role
 *                 example: ["perm1", "perm2"]
 *     responses:
 *       200:
 *         description: Permissions assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 roleID:
 *                   type: string
 *                   description: The ID of the role
 *                 assignedPermissions:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Names of the assigned permissions
 *                 totalAssigned:
 *                   type: integer
 *                   description: Total number of permissions assigned to the role
 *       400:
 *         description: Role ID or permission IDs are required or invalid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Role ID and at least one permission ID are required"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions or cannot assign Role/Permission class
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'assign_permissions' required"
 *       404:
 *         description: Role or permissions not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Role not found"
 */
router.post('/role/:roleID/assign', requirePermission('assign_permissions'), PermissionController.assignPermissionsToRole);

/**
 * @swagger
 * /permissions/role/{roleID}/revoke:
 *   post:
 *     summary: Revoke permissions from a role
 *     tags: [Permissions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: roleID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the role to revoke permissions from
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - permissionIDs
 *             properties:
 *               permissionIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of permission IDs to revoke from the role
 *                 example: ["perm1", "perm2"]
 *     responses:
 *       200:
 *         description: Permissions revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     roleID:
 *                       type: string
 *                       description: The ID of the role
 *                     revokedPermission:
 *                       type: string
 *                       description: Name of the revoked permission
 *                     totalAssigned:
 *                       type: integer
 *                       description: Number of permissions still assigned to the role
 *                 - type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       roleID:
 *                         type: string
 *                         description: The ID of the role
 *                       revokedPermission:
 *                         type: string
 *                         description: Name of the revoked permission
 *                       totalAssigned:
 *                         type: integer
 *                         description: Number of permissions still assigned to the role
 *       400:
 *         description: Role ID or permission IDs are required or invalid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Role ID and permission IDs are required"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'revoke_permissions' required"
 *       404:
 *         description: Role or permissions not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Role not found"
 */
router.post('/role/:roleID/revoke', requirePermission('revoke_permissions'), PermissionController.revokePermissionsFromRole);

/**
 * @swagger
 * /permissions/role/{roleID}:
 *   get:
 *     summary: Retrieve permissions assigned to a role
 *     tags: [Roles]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: roleID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the role to retrieve permissions for
 *     responses:
 *       200:
 *         description: List of permissions assigned to the role
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   permissionID:
 *                     type: string
 *                     description: Unique identifier for the permission
 *                   name:
 *                     type: string
 *                     description: Name of the permission
 *                   class:
 *                     type: string
 *                     description: Class or category of the permission
 *                   description:
 *                     type: string
 *                     description: Description of the permission
 *       400:
 *         description: Role ID is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Role ID is required"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Permission 'access_permissions_by_role' required"
 *       404:
 *         description: Role not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Role not found"
 */
router.get('/role/:roleID', requirePermission('access_permissions_by_role'), PermissionController.getPermissionsByRole);

/**
 * @swagger
 * /permissions/effective/{userID}:
 *   get:
 *     summary: Retrieve effective permissions for a user
 *     tags: [Permissions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userID
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to retrieve effective permissions for
 *     responses:
 *       200:
 *         description: List of effective permissions for the user
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   permissionID:
 *                     type: string
 *                     description: Unique identifier for the permission
 *                   name:
 *                     type: string
 *                     description: Name of the permission
 *                   class:
 *                     type: string
 *                     description: Class or category of the permission
 *                   description:
 *                     type: string
 *                     description: Description of the permission
 *       400:
 *         description: User ID is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User ID is required"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token required"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User not found"
 */
router.get('/effective/:userID', PermissionController.getEffectivePermissions);

module.exports = router;