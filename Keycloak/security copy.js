const Keycloak = require('keycloak-connect');
require('dotenv').config();

const requiredEnv = ['KEYCLOAK_REALM', 'KEYCLOAK_URL', 'KEYCLOAK_CLIENT_ID', 'KEYCLOAK_CLIENT_SECRET'];
requiredEnv.forEach((env) => {
    if (!process.env[env]) {
        console.error(`Missing required environment variable: ${env}`);
        process.exit(1);
    }
});

const keycloak = new Keycloak({}, {
    realm: process.env.KEYCLOAK_REALM,
    'auth-server-url': process.env.KEYCLOAK_URL,
    'ssl-required': 'external',
    resource: process.env.KEYCLOAK_CLIENT_ID,
    credentials: { secret: process.env.KEYCLOAK_CLIENT_SECRET },
    'confidential-port': 0,
});

const authenticateJWT = keycloak.middleware();

const requirePermission = (permissionName) => {
    return (req, res, next) => {
        if (!req.kauth.grant) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const token = req.kauth.grant.access_token.content;
        const permissions = token.resource_access?.[process.env.KEYCLOAK_CLIENT_ID]?.roles || [];
        if (!permissions.includes(permissionName)) {
            return res.status(403).json({ error: `Permission '${permissionName}' required` });
        }
        // Map Keycloak token to req.user for consistency with existing code
        req.user = {
            userID: token.sub, // Keycloak user ID
            email: token.email,
            phone: token.phone || '', 
            wallet: token.wallet || '', 
            roles: token.realm_access?.roles || [],
            permissions,
            supervisor_ids: token.supervisor_ids || [], 
        };
        next();
    };
};

const restrictTo = (...allowedRoles) => {
    return keycloak.protect((token) => allowedRoles.some(role => token.hasRole(role)));
};

module.exports = { keycloak, authenticateJWT, requirePermission, restrictTo };