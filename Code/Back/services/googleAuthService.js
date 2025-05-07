const { google } = require('googleapis');
const axios = require('axios');
const { User, Role, Permission } = require('../models');
const logger = require('../utils/logger');
require('dotenv').config();

const ERROR_MESSAGES = {
    GOOGLE_LOGIN_FAILED: 'Google login failed. Ensure your account is registered.',
    KEYCLOAK_TOKEN_EXCHANGE_FAILED: 'Failed to exchange Google token with Keycloak.',
};

class GoogleAuthService {
    static getOAuth2Client() {
        return new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
    }

    static async getAuthUrl() {
        try {
            const oauth2Client = this.getOAuth2Client();
            const scopes = [
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/calendar',
            ];

            const url = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: scopes,
                prompt: 'consent',
                response_type: 'code',
            });

            logger.info('Generated Google OAuth authorization URL');
            return url;
        } catch (error) {
            logger.error(`Get auth URL error: ${error.message}`);
            throw new Error(`Failed to generate auth URL: ${error.message}`);
        }
    }

    static async googleLogin(code, deviceIdentifier, res) {
        try {
            const oauth2Client = this.getOAuth2Client();
            logger.info('Exchanging Google OAuth code', { code: code.substring(0, 10) + '...' });
            const { tokens } = await oauth2Client.getToken(code);
            logger.info('Google tokens received', {
                access_token: tokens.access_token ? 'present' : 'missing',
                refresh_token: tokens.refresh_token ? 'present' : 'missing',
                scope: tokens.scope,
                expiry_date: tokens.expiry_date,
            });
            oauth2Client.setCredentials(tokens);

            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
            const { data: userInfo } = await oauth2.userinfo.get();
            logger.info('Google user info retrieved', {
                email: userInfo.email,
                name: userInfo.name,
                id: userInfo.id,
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
                    googleAccessToken: tokens.access_token,
                    googleRefreshToken: tokens.refresh_token,
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
                user.googleAccessToken = tokens.access_token;
                user.googleRefreshToken = tokens.refresh_token;
                await user.save();
            }

            // Exchange Google token for Keycloak token using Identity Provider
            logger.info('Attempting Keycloak token exchange', {
                keycloak_url: process.env.KEYCLOAK_URL,
                realm: process.env.REALM,
                client_id: process.env.KEYCLOAK_CLIENT_ID,
                endpoint: `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}/broker/google/token`,
            });
            const keycloakResponse = await axios.post(
                `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}/broker/google/token`,
                new URLSearchParams({
                    client_id: process.env.KEYCLOAK_CLIENT_ID,
                    client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
                    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
                    subject_token: tokens.access_token,
                    subject_issuer: 'google',
                    subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
                }),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                }
            ).catch(error => {
                logger.error('Keycloak token exchange failed', {
                    status: error.response?.status,
                    data: error.response?.data,
                    message: error.message,
                    request_url: `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}/broker/google/token`,
                    request_body: {
                        client_id: process.env.KEYCLOAK_CLIENT_ID,
                        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
                        subject_issuer: 'google',
                        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
                    },
                });
                throw new Error(ERROR_MESSAGES.KEYCLOAK_TOKEN_EXCHANGE_FAILED);
            });

            const { access_token, refresh_token, expires_in } = keycloakResponse.data;
            logger.info('Keycloak tokens received', {
                access_token: access_token ? 'present' : 'missing',
                refresh_token: refresh_token ? 'present' : 'missing',
                expires_in,
            });

            // Update user with Keycloak ID if not set
            if (!user.keycloakId && keycloakResponse.data.sub) {
                user.keycloakId = keycloakResponse.data.sub;
                await user.save();
                logger.info(`Updated user ${user.userID} with keycloakId ${user.keycloakId}`);
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
            logger.error(`Google login error: ${error.message}`, { stack: error.stack });
            const err = new Error(error.message === ERROR_MESSAGES.KEYCLOAK_TOKEN_EXCHANGE_FAILED
                ? error.message
                : ERROR_MESSAGES.GOOGLE_LOGIN_FAILED);
            err.status = error.response?.status || 401;
            throw err;
        }
    }
}

module.exports = GoogleAuthService;