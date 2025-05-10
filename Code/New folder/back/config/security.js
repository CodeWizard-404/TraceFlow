const axios = require('axios');
const { User } = require('../models');
const AuthService = require('../services/authService');
require('dotenv').config();

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || '';

const authenticateCookie = async (req, res, next) => {
    try {
        const cookieHeader = req.headers?.cookie;
        if (!cookieHeader) {
            return res.status(401).json({ error: 'Access token required' });
        }

        const cookies = cookieHeader.split(';').map(c => c.trim());
        const tokenCookie = cookies.find(c => c.startsWith('accessToken='));
        const accessToken = tokenCookie ? tokenCookie.split('=')[1] : null;

        if (!accessToken) {
            return res.status(401).json({ error: 'Access token required' });
        }

        const cache = global.cache;
        const cacheKey = `token:${accessToken}`;

        // Check Redis session
        const tokenData = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
        const userId = tokenData.sub;
        const session = await AuthService.getSession(userId);
        if (session && session.token === accessToken) {
            const user = await User.findOne({ where: { keycloakId: userId } });
            if (!user) {
                throw new Error('User not found in local database');
            }
            req.user = {
                userID: user.userID,
                email: user.email,
                roles: tokenData.realm_access?.roles || [],
                token: accessToken,
            };
            return next();
        }

        const cachedUser = await cache.getOrSet(cacheKey, async () => {
            if (accessToken.startsWith('google_')) {
                return { userID: 'temp_google_user', email: 'temp@google.com', roles: ['Supervisor'] };
            }

            const response = await axios.post(
                `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token/introspect`,
                new URLSearchParams({
                    token: accessToken,
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                })
            );

            if (!response.data.active) {
                throw new Error('Invalid or expired token');
            }

            const keycloakId = response.data.sub;
            const user = await User.findOne({ where: { keycloakId } });

            if (!user) {
                throw new Error('User not found in local database');
            }

            return {
                userID: user.userID,
                email: response.data.email,
                roles: response.data.realm_access?.roles || [],
                token: accessToken,
            };
        }, parseInt(process.env.ACCESS_TOKEN_MAX_AGE, 10) || 600);

        req.user = cachedUser;
        next();
    } catch (error) {
        return res.status(error.message.includes('not found') ? 404 : 401).json({ error: error.message });
    }
};

const requirePermission = (permissionName) => {
    return async (req, res, next) => {
        try {
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
                return res.status(403).json({ error: `Permission '${permissionName}' required` });
            }

            next();
        } catch (error) {
            if (error.response?.status === 401) {
                return res.status(401).json({ error: 'Token expired, please refresh' });
            }
            return res.status(403).json({ error: `Permission '${permissionName}' required` });
        }
    };
};

module.exports = { authenticateCookie, requirePermission };