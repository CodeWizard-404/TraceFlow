const axios = require('axios');
const logger = require('../utils/logger');
const { User } = require('../models'); // Import User model
require('dotenv').config();

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || '';

const authenticateCookie = async (req, res, next) => {
    try {
        const accessToken = req.cookies?.accessToken;

        if (!accessToken) {
            logger.warn('No access token provided');
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
                logger.warn('Token introspection failed: inactive token');
                return res.status(401).json({ error: 'Invalid or expired token' });
            }

            // Fetch local user by keycloakId
            const keycloakId = response.data.sub;
            const user = await User.findOne({ where: { keycloakId } });

            if (!user) {
                logger.error(`No local user found for keycloakId: ${keycloakId}`);
                return res.status(404).json({ error: 'User not found in local database' });
            }

            req.user = {
                userID: user.userID, // Use local database userID
                email: response.data.email,
                roles: response.data.realm_access?.roles || [],
                token: accessToken,
            };
            next();
        } catch (error) {
            logger.error(`Keycloak introspection error: ${error.message}`, {
                status: error.response?.status,
                data: error.response?.data,
            });
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

            if (roles.includes('Super Admin')) {
                logger.info(`Super Admin bypass for user ${req.user.userID}`);
                return next();
            }

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

            const rpt = response.data.access_token;
            const tokenData = JSON.parse(Buffer.from(rpt.split('.')[1], 'base64').toString());
            const permissions = tokenData.authorization?.permissions || [];

            const hasPermission = permissions.some((p) => p.rsname === permissionName);

            if (!hasPermission) {
                logger.warn(`Permission denied for ${permissionName} to user ${req.user.userID}`);
                return res.status(403).json({ error: `Permission '${permissionName}' required` });
            }

            logger.info(`Permission granted for ${permissionName} to user ${req.user.userID}`);
            next();
        } catch (error) {
            logger.error(`Permission check failed for ${permissionName}: ${error.message}`, {
                status: error.response?.status,
                data: error.response?.data,
            });
            if (error.response?.status === 401) {
                return res.status(401).json({ error: 'Token expired, please refresh' });
            }
            return res.status(403).json({ error: `Permission '${permissionName}' required` });
        }
    };
};

module.exports = { authenticateCookie, requirePermission };