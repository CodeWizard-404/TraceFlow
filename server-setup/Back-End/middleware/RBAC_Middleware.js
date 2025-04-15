const rbacMiddleware = (requiredPermission) => {
    return async (req, res, next) => {
        // authenticateJWT has already run and attached req.user
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required. Please log in.' });
        }

        try {
            // Check if user has the required permission
            const hasPermission = req.user.Roles.some(role =>
                role.Permissions.some(perm => perm.permission === requiredPermission)
            );

            if (!hasPermission) {
                return res.status(403).json({
                    error: `Permission '${requiredPermission}' required for this action`
                });
            }

            // User has permission, proceed
            next();
        } catch (error) {
            console.error('RBAC Middleware Error:', error);
            return res.status(500).json({ error: 'Internal server error during authorization' });
        }
    };
};

module.exports = rbacMiddleware;