const axios = require('axios');
const { User, Role, Permission } = require('../models');
const logger = require('../utils/logger');
require('dotenv').config();

const ERROR_MESSAGES = {
    GOOGLE_LOGIN_FAILED: 'Google login failed. Ensure your account is registered.',
    KEYCLOAK_TOKEN_EXCHANGE_FAILED: 'Failed to exchange Keycloak authorization code.',
};

class GoogleAuthService {
    static async getAuthUrl() {
        // No longer needed as frontend constructs Keycloak OAuth URL
        throw new Error('Method deprecated. Use Keycloak OAuth URL directly.');
    }

    static async googleLogin(code, deviceIdentifier, res) {
        try {
            const keycloakBaseUrl = `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}`;
            logger.info('Exchanging Keycloak authorization code', { code: code.substring(0, 10) + '...' });

            // Exchange code for Keycloak tokens
            const tokenResponse = await axios.post(
                `${keycloakBaseUrl}/protocol/openid-connect/token`,
                new URLSearchParams({
                    client_id: process.env.KEYCLOAK_CLIENT_ID,
                    client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: 'http://localhost:5173/api/auth/callback',
                }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );

            const { access_token, refresh_token, expires_in } = tokenResponse.data;
            logger.info('Keycloak tokens received', {
                access_token: access_token ? 'present' : 'missing',
                refresh_token: refresh_token ? 'present' : 'missing',
                expires_in,
            });

            // Get user info from Keycloak
            const userInfoResponse = await axios.get(
                `${keycloakBaseUrl}/protocol/openid-connect/userinfo`,
                { headers: { Authorization: `Bearer ${access_token}` } }
            );
            const userInfo = userInfoResponse.data;
            logger.info('Keycloak user info retrieved', {
                email: userInfo.email,
                name: userInfo.name,
                sub: userInfo.sub,
            });

            let user = await User.findOne({
                where: { googleEmail: userInfo.email },
                include: [
                    {
                        model: Role,
                        through: { attributes: [] },
                        include: [
                            {
                                model: Permission,
                                through: { attributes: [] },
                                attributes: ['name', 'class', 'permissionID', 'description'],
                            },
                        ],
                    },
                ],
            });

            if (!user) {
                user = await User.create({
                    userID: `usr_${require('nanoid')()}`,
                    firstname: userInfo.given_name || 'Unknown',
                    lastname: userInfo.family_name || 'Unknown',
                    phone: 'N/A',
                    email: userInfo.email,
                    password: 'N/A',
                    googleEmail: userInfo.email,
                    keycloakId: userInfo.sub,
                });

                // Assign default Supervisor role
                let supervisorRole = await Role.findOne({ where: { name: 'Supervisor' } });
                if (!supervisorRole) {
                    supervisorRole = await Role.create({
                        roleID: `role_${require('nanoid')()}`,
                        name: 'Supervisor',
                        description: 'Default role for new users',
                    });
                }
                await user.addRole(supervisorRole);
                logger.info(`Assigned Supervisor role to new user ${user.userID}`);
            } else {
                if (!user.keycloakId) {
                    user.keycloakId = userInfo.sub;
                    await user.save();
                }
            }

            const userData = {
                userID: user.userID,
                email: user.email,
                phone: user.phone,
                firstname: user.firstname,
                lastname: user.lastname,
                keycloakId: user.keycloakId || '',
                Roles: user.Roles?.map((role) => ({
                    roleID: role.roleID,
                    name: role.name,
                    description: role.description,
                    permissions: role.Permissions?.map((perm) => ({
                        permissionID: perm.permissionID,
                        name: perm.name,
                        class: perm.class,
                        description: perm.description,
                    })) || [],
                })) || [],
            };

            const cookieOptions = {
                path: '/',
                sameSite: process.env.NODE_ENV === 'development' ? 'Lax' : 'None',
                secure: process.env.NODE_ENV === 'production',
                maxAge: parseInt(process.env.ACCESS_TOKEN_MAX_AGE) || 900000,
            };

            res.cookie('accessToken', access_token, { ...cookieOptions, httpOnly: true });
            res.cookie('refreshToken', refresh_token, {
                ...cookieOptions,
                maxAge: parseInt(process.env.REFRESH_TOKEN_MAX_AGE) || 86400000,
                httpOnly: true,
            });
            res.cookie('userData', encodeURIComponent(JSON.stringify(userData)), cookieOptions);

            logger.info(`Google login successful for user ${user.userID}`, {
                cookiesSet: ['accessToken', 'refreshToken', 'userData'],
                userData: { userID: user.userID, email: user.email, roles: userData.Roles.map(r => r.name) },
            });

            return {
                user: userData,
                accessToken: access_token,
                expiresIn: expires_in * 1000,
            };
        } catch (error) {
            logger.error(`Google login error: ${error.message}`, {
                status: error.response?.status,
                data: error.response?.data,
                stack: error.stack,
            });
            const err = new Error(error.message === ERROR_MESSAGES.KEYCLOAK_TOKEN_EXCHANGE_FAILED
                ? error.message
                : ERROR_MESSAGES.GOOGLE_LOGIN_FAILED);
            err.status = error.response?.status || 401;
            throw err;
        }
    }
}

module.exports = GoogleAuthService;