const { auth } = require('express-oauth2-jwt-bearer');
const { User } = require('../models');
require('dotenv').config();
const axios = require('axios');
const PermissionService = require('../services/permissionService');

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


const jwt = require('jsonwebtoken');

const requirePermission = (permissionName) => {
    return async (req, res, next) => {
        try {
            // Extract roles from token
            const roles = req.auth.payload.realm_access?.roles || [];

            // Bypass for Super Admin
            if (roles.includes("Super Admin")) {
                console.log('Super Admin detected, bypassing permission checks');
                return next();
            }

            // Step 1: Keycloak permission check
            const response = await axios.post(
                `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
                    audience: 'traceflow-backend',
                }),
                {
                    headers: {
                        Authorization: `Bearer ${req.auth.token}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            const rpt = jwt.decode(response.data.access_token);
            const permissions = rpt?.authorization?.permissions || [];
            const hasKeycloakPermission = permissions.some(p => p.rsname === permissionName);

            if (!hasKeycloakPermission) {
                console.log(`Keycloak denied permission: ${permissionName}`);
                return res.status(403).json({ error: `Permission '${permissionName}' required` });
            }

            // Step 2: Local effective permissions check
            const userId = req.user.userID; // From populateUser
            const effectivePermissions = await PermissionService.getEffectivePermissions(userId);
            const hasEffectivePermission = effectivePermissions.some(p => p.name === permissionName);

            if (!hasEffectivePermission) {
                console.log(`Local override denied permission: ${permissionName}`);
                return res.status(403).json({ error: `Permission '${permissionName}' revoked by override` });
            }

            console.log(`Permission granted: ${permissionName}`);
            next();
        } catch (error) {
            console.error('Permission check failed:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message,
            });
            if (error.response?.status === 401) {
                return res.status(401).json({ error: 'Token expired, please refresh' });
            }
            return res.status(403).json({ error: `Permission '${permissionName}' required` });
        }
    };
};

module.exports = { authenticateKeycloak: authenticateAndPopulate, requirePermission };