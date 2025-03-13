const jwt = require('jsonwebtoken');
const { Role, User } = require('../models');
const { sequelize } = require('./db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

const authenticateJWT = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = await User.findByPk(decoded.userID, {
            include: [{ model: Role, through: { attributes: [] } }],
        });
        if (!req.user) throw new Error('User not found');
        // Set RLS variable here
        await sequelize.query(`SET jwt.claims.userID = '${req.user.userID}'`);
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

const restrictTo = (...allowedRoles) => {
    return (req, res, next) => {
        const userRoles = req.user.Roles.map(role => role.name);
        const hasPermission = allowedRoles.some(role => userRoles.includes(role));
        if (!hasPermission) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

module.exports = { authenticateJWT, restrictTo };