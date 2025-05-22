const axios = require('axios');
const { User, Role, Permission } = require('../models');
const VaultService = require('./vaultService');
require('dotenv').config();

const ERROR_MESSAGES = {
    GOOGLE_LOGIN_FAILED: 'Google login failed. Ensure your account is registered.',
    KEYCLOAK_TOKEN_EXCHANGE_FAILED: 'Failed to exchange Keycloak authorization code.',
    USER_NOT_FOUND: 'No account found with this Google email. Please use an existing account.',
    CALENDAR_AUTH_FAILED: 'Failed to authorize Google Calendar access.',
};

class GoogleAuthService {

    static async googleLogin(code, res) {
        try {
            const keycloakBaseUrl = `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}`;

            const tokenResponse = await axios.post(
                `${keycloakBaseUrl}/protocol/openid-connect/token`,
                new URLSearchParams({
                    client_id: process.env.KEYCLOAK_CLIENT_ID,
                    client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: process.env.BACKEND_REDIRECT_URI,
                }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );

            const { access_token, refresh_token, expires_in } = tokenResponse.data;

            const userInfoResponse = await axios.get(
                `${keycloakBaseUrl}/protocol/openid-connect/userinfo`,
                { headers: { Authorization: `Bearer ${access_token}` } }
            );
            const userInfo = userInfoResponse.data;

            const user = await User.findOne({
                where: { email: userInfo.email },
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
                throw Object.assign(new Error(ERROR_MESSAGES.USER_NOT_FOUND), { status: 404 });
            }

            if (!user.keycloakId || user.keycloakId !== userInfo.sub) {
                await user.update({ keycloakId: userInfo.sub });
            }

            const userData = {
                userID: user.userID,
                email: user.email,
                phone: user.phone || '',
                firstname: user.firstname || '',
                lastname: user.lastname || '',
                keycloakId: user.keycloakId || '',
                Roles: user.Roles?.map((role) => ({
                    roleID: role.roleID,
                    name: role.name,
                    description: role.description || '',
                })) || [],
            };

            const cookieOptions = {
                path: '/',
                sameSite: process.env.NODE_ENV === 'development' ? 'Lax' : 'None',
                secure: process.env.NODE_ENV === 'production',
                maxAge: parseInt(process.env.ACCESS_TOKEN_MAX_AGE) || 900000,
            };

            const jsonUserData = JSON.stringify(userData);


            res.cookie('accessToken', access_token, { ...cookieOptions, httpOnly: true });
            res.cookie('refreshToken', refresh_token, {
                ...cookieOptions,
                maxAge: parseInt(process.env.REFRESH_TOKEN_MAX_AGE) || 86400000,
                httpOnly: true,
            });
            res.cookie('userData', jsonUserData, cookieOptions);



            return {
                user: userData,
                accessToken: access_token,
                expiresIn: expires_in * 1000,
            };
        } catch (error) {
            const err = new Error(
                error.message === ERROR_MESSAGES.KEYCLOAK_TOKEN_EXCHANGE_FAILED ||
                    error.message === ERROR_MESSAGES.USER_NOT_FOUND
                    ? error.message
                    : ERROR_MESSAGES.GOOGLE_LOGIN_FAILED
            );
            err.status = error.response?.status || error.status || 401;
            throw err;
        }
    }






    static async googleCalendarCallback(code, userId) {
        try {
            const response = await axios.post(
                'https://oauth2.googleapis.com/token',
                new URLSearchParams({
                    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
                    client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
                }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );

            const { refresh_token } = response.data;
            await VaultService.storeRefreshToken(userId, refresh_token);

            return { message: 'Calendar access granted' };
        } catch (error) {
            throw new Error(ERROR_MESSAGES.CALENDAR_AUTH_FAILED);
        }
    }
}

module.exports = GoogleAuthService;