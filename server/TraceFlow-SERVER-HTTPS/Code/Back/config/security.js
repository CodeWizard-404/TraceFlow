const axios = require('axios');
const { User } = require('../models');
const AuthService = require('../services/authService');
require('dotenv').config();

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || '';

const authenticateCookie = async (req, res, next) => {
    const accessToken = req.headers.cookie?.match(/accessToken=([^;]+)/)?.[1];
    if (!accessToken) return res.status(401).json({ error: 'Token required' });

    const tokenData = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    const userId = tokenData.sub;
    const cacheKey = `token:${accessToken}`;

    // Check session first
    const session = await AuthService.getSession(userId);
    if (session?.token === accessToken) {
        const user = await User.findOne({ where: { keycloakId: userId } });
        if (user) {
            req.user = { userID: user.userID, email: user.email, roles: tokenData.realm_access?.roles || [], token: accessToken };
            return next();
        }
    }

    const ttl = tokenData.exp - Math.floor(Date.now() / 1000); // Dynamic TTL
    const cachedUser = await global.cache.getOrSet(cacheKey, async () => {
        const response = await axios.post(
            `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}/protocol/openid-connect/token/introspect`,
            new URLSearchParams({
                token: accessToken,
                client_id: process.env.KEYCLOAK_CLIENT_ID,
                client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
            })
        );

        if (!response.data.active) throw new Error('Invalid token');
        const user = await User.findOne({ where: { keycloakId: response.data.sub } });
        if (!user) throw new Error('User not found');

        return {
            userID: user.userID,
            email: response.data.email,
            roles: response.data.realm_access?.roles || [],
            token: accessToken,
        };
    }, ttl);

    req.user = cachedUser;
    next();
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