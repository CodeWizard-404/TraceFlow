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
                token: accessToken, // Store token for permission checks
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
        try {
            const roles = req.user.roles || [];

            // Bypass for Super Admin
            if (roles.includes('Super Admin')) {
                logger.info('Super Admin detected, bypassing permission checks');
                return next();
            }

            // Request a Resource Permission Ticket (RPT) from Keycloak
            const response = await axios.post(
                `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
                    audience: CLIENT_ID,
                    permission: permissionName,
                }),
                {
                    headers: {
                        Authorization: `Bearer ${req.user.token}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            // Decode the RPT to check permissions
            const rpt = response.data.access_token;
            const tokenData = JSON.parse(Buffer.from(rpt.split('.')[1], 'base64').toString());
            const permissions = tokenData.authorization?.permissions || [];

            // Check if the requested permission is granted
            const hasPermission = permissions.some((p) => p.rsname === permissionName);

            if (!hasPermission) {
                logger.warn(`Permission denied for ${permissionName}`);
                return res.status(403).json({ error: `Permission '${permissionName}' required` });
            }

            logger.info(`Permission granted for ${permissionName} to user ${req.user.userID}`);
            next();
        } catch (error) {
            logger.error(`Permission check failed for ${permissionName}: ${error.message}`);
            if (error.response?.status === 401) {
                return res.status(401).json({ error: 'Token expired, please refresh' });
            }
            return res.status(403).json({ error: `Permission '${permissionName}' required` });
        }
    };
};

module.exports = { authenticateCookie, requirePermission };