const { User, Role, Permission } = require('../models');

const rbacMiddleware = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            // Assume JWT token is in Authorization header
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) return res.status(401).json({ error: 'No token provided' });

            // Verify JWT (you’d use jsonwebtoken package here)
            const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
            const userID = decoded.userID;

            // Fetch user with roles and permissions
            const user = await User.findByPk(userID, {
                include: [{
                    model: Role,
                    through: { attributes: [] },
                    include: [{ model: Permission }],
                }],
            });
            if (!user) return res.status(401).json({ error: 'User not found' });

            // Check if user has the required permission
            const hasPermission = user.Roles.some(role =>
                role.Permissions.some(perm => perm.permission === requiredPermission)
            );
            if (!hasPermission) {
                return res.status(403).json({ error: `Permission '${requiredPermission}' required` });
            }

            // Attach user to request for downstream use
            req.user = user;
            next();
        } catch (error) {
            res.status(401).json({ error: 'Invalid token or authorization error' });
        }
    };
};

module.exports = rbacMiddleware;