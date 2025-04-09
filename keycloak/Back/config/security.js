const { auth } = require('express-oauth2-jwt-bearer');
const { User } = require('../models'); // Import your User model
require('dotenv').config();
const axios = require('axios');

// Configure Keycloak token validation
const authenticateKeycloak = auth({
    issuerBaseURL: `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}`,
    audience: ["traceflow-backend", "account"],
    jwksUri: `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}/protocol/openid-connect/certs`,
    tokenSigningAlg: 'RS256',
});

// Custom middleware to populate req.user with userID from the database
const populateUser = async (req, res, next) => {
    if (req.auth && req.auth.payload) {
        const keycloakId = req.auth.payload.sub; // Keycloak's sub
        const roles = req.auth.payload.realm_access?.roles || [];

        try {
            // Fetch the user from the database using keycloakId
            const user = await User.findOne({ where: { keycloakId } });
            if (!user) {
                console.error(`User with keycloakId ${keycloakId} not found in database`);
                return res.status(401).json({ error: 'User not found in database' });
            }

            // Populate req.user with the database userID
            req.user = {
                userID: user.userID, // Use the nanoid-generated userID
                keycloakId: user.keycloakId,
                email: req.auth.payload.email || user.email,
                phone: req.auth.payload.phone || user.phone || '',
                roles,
            };
        } catch (error) {
            console.error('Error fetching user from database:', error);
            return res.status(500).json({ error: 'Internal server error during user lookup' });
        }
    }
    next();
};

// Combine authenticateKeycloak with populateUser
const authenticateAndPopulate = [authenticateKeycloak, populateUser];

// Permission middleware (fully Keycloak-based)
const requirePermission = (permissionName) => {
    return async (req, res, next) => {
        const roles = req.auth.payload.realm_access?.roles || [];
        const overrides = JSON.parse(req.auth.payload.permission_overrides || '{}');

        // Super Admin bypass
        if (roles.includes("Super Admin")) {
            // Ensure req.user is already populated by populateUser, no need to repeat
            return next();
        }

        const userOverride = Object.values(overrides).some(roleOverrides =>
            roleOverrides[permissionName] === 'grant' ? true :
                roleOverrides[permissionName] === 'revoke' ? false : null
        );
        if (userOverride === false) {
            return res.status(403).json({ error: `Permission '${permissionName}' required` });
        }
        if (userOverride === true) {
            return next();
        }

        try {
            const response = await axios.post(
                `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}/authz/entitlement/traceflow-backend`,
                { permissions: [{ id: permissionName }] },
                { headers: { Authorization: `Bearer ${req.auth.token}` } }
            );
            const hasPermission = response.data.rpt && response.data.rpt.permissions.some(p => p.resource === permissionName);
            if (!hasPermission) {
                return res.status(403).json({ error: `Permission '${permissionName}' required` });
            }
        } catch (error) {
            console.error("Permission check failed:", error.response?.data || error.message);
            return res.status(403).json({ error: `Permission '${permissionName}' required` });
        }

        next();
    };
};

module.exports = { authenticateKeycloak: authenticateAndPopulate, requirePermission };