const jwt = require('jsonwebtoken');
const { sequelize } = require('./db');
const { Role, User, Permission } = require('../models');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

const authenticateJWT = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Authentication failed: No token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findByPk(decoded.userID, {
            include: [
                {
                    model: Role,
                    through: { attributes: [] },
                    include: [{ model: Permission, through: { attributes: [] } }],
                },
            ],
        });
        if (!user) {
            return res.status(401).json({ error: 'Authentication failed: User not found' });
        }
        req.user = user;
        await sequelize.query(`SET jwt.claims.userID = '${user.userID}'`);
        next();
    } catch (error) {
        console.error(`${new Date().toISOString()} - JWT verification failed:`, error.message);
        return res.status(401).json({ error: `Authentication failed: Invalid or expired token - ${error.message}` });
    }
};

const requirePermission = (permissionName) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required: Please log in' });
        }
        const userPermissions = req.user.Roles.flatMap(role => role.Permissions.map(perm => perm.name));
        if (!userPermissions.includes(permissionName)) {
            console.warn(`${new Date().toISOString()} - Permission denied for user ${req.user.userID}: Missing ${permissionName}`);
            return res.status(403).json({ error: `Access denied: '${permissionName}' permission required` });
        }
        next();
    };
};

module.exports = { authenticateJWT, requirePermission };