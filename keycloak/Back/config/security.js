const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || 'your-client-secret-from-keycloak';

const authenticateCookie = async (req, res, next) => {
    try {
        const accessToken = req.cookies?.accessToken;

        if (!accessToken) {
            return res.status(401).json({ error: 'Access token required' });
        }

        try {
            const response = await axios.post(
                `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token/introspect`,
                new URLSearchParams({
                    token: accessToken,
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                })
            );

            if (!response.data.active) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }

            req.user = {
                userID: response.data.sub,
                email: response.data.email,
                roles: response.data.realm_access?.roles || [],
            };
            next();
        } catch (error) {
            logger.error(`Keycloak introspection error: ${error.message}`);
            return res.status(error.response?.status || 401).json({ error: 'Invalid token' });
        }
    } catch (error) {
        logger.error(`Authentication error: ${error.message}`);
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

const requirePermission = (permissionName) => {
    return async (req, res, next) => {
        console.log('1User Roles:', req.user.roles);
        try {
            const roles = req.user.roles || [];
            console.log('2User Roles:', roles);

            if (roles.includes('Super Admin')) {
                console.log('3User has Super Admin role. Skipping permission check.');
                return next();
            }

            const hasPermission = roles.includes(permissionName) || req.user.permissions?.includes(permissionName);
            console.log(`4.1User permission: ${roles.includes(permissionName)}`);
            console.log(`4.2User permission: ${req.user.permissions?.includes(permissionName)}`);
            console.log(`4.3User permission: ${hasPermission}`);
            if (!hasPermission) {
                console.log(`5User does not have permission: ${permissionName}`);
                return res.status(403).json({ error: `Permission '${permissionName}' required` });
            }

            logger.info(`User ${req.user.userID} has permission: ${permissionName}`);
            console.log(`6User has permission: ${permissionName}`);

            next();
            console.log(`7User has permission: ${permissionName}`);
        } catch (error) {
            console.error(`8Permission check failed for ${permissionName}: ${error.message}`);
            logger.error(`Permission check failed for ${permissionName}: ${error.message}`);
            return res.status(403).json({ error: `Permission '${permissionName}' required` });
        }
    };
};

module.exports = { authenticateCookie, requirePermission };