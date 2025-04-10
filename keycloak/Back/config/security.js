const { auth } = require('express-oauth2-jwt-bearer');
const { User } = require('../models');
require('dotenv').config();
const axios = require('axios');

const authenticateKeycloak = auth({
    issuerBaseURL: `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}`,
    audience: ["traceflow-backend", "account"],
    jwksUri: `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}/protocol/openid-connect/certs`,
    tokenSigningAlg: 'RS256',
});

const populateUser = async (req, res, next) => {
    if (req.auth && req.auth.payload) {
        const keycloakId = req.auth.payload.sub;
        const roles = req.auth.payload.realm_access?.roles || [];

        const issuedAt = req.auth.payload.iat;
        const expiresAt = req.auth.payload.exp;
        const lifespanSeconds = expiresAt - issuedAt;
        const expiresDate = new Date(expiresAt * 1000);
        console.log(`Token for ${keycloakId}:`);
        console.log(`- Issued At: ${new Date(issuedAt * 1000)}`);
        console.log(`- Expires At: ${expiresDate}`);
        console.log(`- Lifespan: ${lifespanSeconds} seconds (${lifespanSeconds / 60} minutes)`);

        try {
            const user = await User.findOne({ where: { keycloakId } });
            if (!user) {
                console.error(`User with keycloakId ${keycloakId} not found in database`);
                return res.status(401).json({ error: 'User not found in database' });
            }

            req.user = {
                userID: user.userID,
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

const authenticateAndPopulate = [authenticateKeycloak, populateUser];

const requirePermission = (permissionName) => {
    return async (req, res, next) => {
        try {
            const roles = req.auth.payload.realm_access?.roles || [];
            const overrides = JSON.parse(req.auth.payload.permission_overrides || '{}');

            if (roles.includes("Super Admin")) return next();

            const userOverride = Object.values(overrides).some(roleOverrides =>
                roleOverrides[permissionName] === 'grant' ? true :
                    roleOverrides[permissionName] === 'revoke' ? false : null
            );
            if (userOverride === false) {
                return res.status(403).json({ error: `Permission '${permissionName}' required` });
            }
            if (userOverride === true) return next();

            const response = await axios.post(
                `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}/authz/entitlement/traceflow-backend`,
                { permissions: [{ id: permissionName }] },
                { headers: { Authorization: `Bearer ${req.auth.token}` } }
            );
            const hasPermission = response.data.rpt && response.data.rpt.permissions.some(p => p.resource === permissionName);
            if (!hasPermission) {
                return res.status(403).json({ error: `Permission '${permissionName}' required` });
            }
            next();
        } catch (error) {
            if (error.response?.status === 401) {
                return res.status(401).json({ error: 'Token expired, please refresh' });
            }
            console.error("Permission check failed:", error.response?.data || error.message);
            return res.status(403).json({ error: `Permission '${permissionName}' required` });
        }
    };
};

module.exports = { authenticateKeycloak: authenticateAndPopulate, requirePermission };