const jwt = require('jsonwebtoken');
const { Role, User, Permission } = require('../models');
const { sequelize } = require('./db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to authenticate JWT tokens and attach user data to the request
const authenticateJWT = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // Extract token from Authorization header
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        // Verify the token and decode its payload
        const decoded = jwt.verify(token, JWT_SECRET);

        // Fetch the user with their roles and permissions
        const user = await User.findByPk(decoded.userID, {
            include: [
                {
                    model: Role,
                    through: { attributes: [] },
                    include: [{ model: Permission, through: { attributes: [] } }],
                },
            ],
        });
        if (!user) throw new Error('User not found');

        // Attach user to the request object
        req.user = user;

        // Set RLS userID for database queries
        await sequelize.query(`SET jwt.claims.userID = '${user.userID}'`);
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Middleware factory to check for a specific permission
const requirePermission = (permissionName) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Extract all permissions from the user’s roles, using 'name' field
        const userPermissions = req.user.Roles.flatMap(role =>
            role.Permissions.map(perm => perm.name) // Change 'permission' to 'name'
        );

        // Check if the required permission is present
        if (!userPermissions.includes(permissionName)) {
            return res.status(403).json({
                error: `Permission '${permissionName}' required`
            });
        }
        next();
    };
};

// Legacy middleware to restrict access based on role names
const restrictTo = (...allowedRoles) => {
    return (req, res, next) => {
        const userRoles = req.user.Roles.map(role => role.name);
        const hasPermission = allowedRoles.some(role => userRoles.includes(role));
        if (!hasPermission) {
            return res.status(403).json({ error: 'Insufficient role permissions' });
        }
        next();
    };
};

module.exports = { authenticateJWT, requirePermission, restrictTo };