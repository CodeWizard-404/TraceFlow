const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const AuthService = require('../services/authService');
const GoogleAuthService = require('../services/googleAuthService');
const NodeCache = require('node-cache');
const axios = require('axios');

const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

const ERROR_MESSAGES = {
    MISSING_FIELDS: 'Please fill in all required fields.',
    USER_NOT_FOUND: 'Account not found.',
    INVALID_TOKEN: 'Session expired. Log in again.',
    SERVER_ERROR: 'Something broke. Try again later.',
    INVALID_CREDENTIALS: 'Wrong email or password.',
    GOOGLE_LOGIN_FAILED: 'Google login failed. Ensure your account is registered.',
    SESSION_NOT_FOUND: 'Session not found. Please log in again.',
};

class AuthController {
    static formatError(error) {
        const response = {
            error: error.message || ERROR_MESSAGES.SERVER_ERROR,
        };
        if (error.waitTime) response.waitTime = error.waitTime;
        if (error.failureCount !== undefined) response.failureCount = error.failureCount;
        return response;
    }



    static async googleCallback(req, res) {
        try {
            res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL);
            res.setHeader('Access-Control-Allow-Credentials', 'true');

            const { code, state } = req.query;
            if (!code) throw new Error('Missing code parameter');

            const result = await GoogleAuthService.googleLogin(code, res);
            await AuthService.storeSession(result.user.userID, result.accessToken);
            const response = { redirect: `${process.env.FRONTEND_URL}/?login=success` };

            logger.info('Google login completed successfully', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 302,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: result.user?.userID || null,
                metadata: {
                    redirectUrl: response.redirect.substring(0, 100),
                    userEmail: result.user?.email ? logger.sensitive(result.user.email) : null
                }
            });

            setTimeout(() => {
                res.redirect(`${process.env.FRONTEND_URL}/?login=success`);
            }, 100);
        } catch (error) {
            const errorMessage = encodeURIComponent(error.message || 'Google login failed');

            logger.error('Google login callback failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 302,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: null,
                metadata: { error: errorMessage }
            });

            res.redirect(`${process.env.FRONTEND_URL}/login?error=${errorMessage}`);
        }
    }


    // controllers/authController.js
    static async googleCalendarAuth(req, res) {
        try {
            res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${process.env.GOOGLE_CALENDAR_CLIENT_ID}&` +
                `redirect_uri=${encodeURIComponent(process.env.GOOGLE_CALENDAR_REDIRECT_URI)}&` +
                `response_type=code&` +
                `scope=${encodeURIComponent('https://www.googleapis.com/auth/calendar')}&` +
                `access_type=offline&` +
                `prompt=consent&` +
                `state=${req.user.userID}`;
            logger.info('Generated Google Calendar auth URL', { userId: req.user.userID, authUrl });
            res.redirect(authUrl);
        } catch (error) {
            logger.error('Google calendar auth failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 500,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user?.userID || null,
                metadata: { error: error.message }
            });
            res.status(500).json({ error: ERROR_MESSAGES.SERVER_ERROR });
        }
    }

    static async googleCalendarCallback(req, res) {
        try {
            res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL);
            res.setHeader('Access-Control-Allow-Credentials', 'true');

            const { code, state } = req.query;
            if (!code) throw new Error('Missing code parameter');
            if (!state) throw new Error('Missing state parameter');

            const result = await GoogleAuthService.googleCalendarCallback(code, state);
            // No need to store session here since Google Calendar auth doesn't generate a new access token
            const response = { redirect: `${process.env.FRONTEND_URL}/?calendar=success` };
            logger.info('Google calendar callback result', {
                userId: state,
                hasRefreshToken: !!result.refreshToken,
            });

            logger.info('Google calendar login completed successfully', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 302,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: state || null,
                metadata: {
                    redirectUrl: response.redirect.substring(0, 100),
                    userEmail: result.user?.email ? logger.sensitive(result.user.email) : null
                }
            });

            setTimeout(() => {
                res.redirect(`${process.env.FRONTEND_URL}/?calendar=success`);
            }, 100);
        } catch (error) {
            const errorMessage = encodeURIComponent(error.message || 'Google calendar login failed');

            logger.error('Google calendar login callback failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 302,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: null,
                metadata: { error: errorMessage }
            });

            res.redirect(`${process.env.FRONTEND_URL}/login?error=${errorMessage}`);
        }
    }


    static async getGoogleCalendarAuthUrl(req, res) {
        try {
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${process.env.GOOGLE_CALENDAR_CLIENT_ID}&` +
                `redirect_uri=${encodeURIComponent(process.env.GOOGLE_CALENDAR_REDIRECT_URI)}&` +
                `response_type=code&` +
                `scope=${encodeURIComponent('https://www.googleapis.com/auth/calendar')}&` +
                `access_type=offline&` +
                `prompt=consent&` +
                `state=${req.user.userID}`;
            res.json({ authUrl });
        } catch (error) {
            logger.error('Failed to get Google Calendar auth URL', { error: error.message });
            res.status(500).json({ error: 'Failed to get authorization URL' });
        }
    }






    static async login(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const { identifier, password, deviceIdentifier, otpMethod } = req.body;
            if (!identifier || !password || !deviceIdentifier) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const cacheKey = `login_${req.traceId}_${deviceIdentifier}`;
            if (cache.get(cacheKey)) {
                throw new Error('Duplicate login request detected');
            }
            cache.set(cacheKey, true, 10);

            const userId = `usr_${identifier}`;
            const session = await AuthService.getSession(userId);
            if (session && session.token) {
                logger.info('Session found, reusing existing session', {
                    traceId: req.traceId,
                    route: 'auth',
                    service: 'api',
                    userId
                });
                return res.status(200).json({
                    accessToken: session.token,
                    user: { userID: userId, email: identifier },
                    expiresIn: 900000
                });
            }

            const result = await AuthService.login(identifier, password, deviceIdentifier, otpMethod, res);

            logger.info('User login successful', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: result.user?.userID || null,
                sensitiveFields: ['email'],
                metadata: {
                    requires2FA: result.requires2FA,
                    email: result.user?.email || null
                }
            });

            return res.status(200).json(result);
        } catch (error) {
            const status = error.message === ERROR_MESSAGES.INVALID_CREDENTIALS ? 401 : 400;
            const response = AuthController.formatError(error);

            logger.error('User login failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.userID || null,
                metadata: { error: response.error }
            });

            return res.status(status).json(response);
        }
    }

    static async verify2FA(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const { userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken } = req.body;
            if (!userID || !otpCode || !deviceIdentifier || trustDevice === undefined || !tempToken || !refreshToken) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }

            const cacheKey = `2fa_${userID}_${deviceIdentifier}`;
            const cachedResult = cache.get(cacheKey);
            if (cachedResult) return res.status(200).json(cachedResult);

            const result = await AuthService.verify2FA(userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken, res);
            cache.set(cacheKey, result, 60);

            logger.info('2FA verification successful', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: userID,
                metadata: {
                    email: result.user?.email ? logger.sensitive(result.user.email) : null,
                    trustDevice
                }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            logger.error('2FA verification failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 400,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.body.userID || null,
                metadata: { error: response.error }
            });

            return res.status(400).json(response);
        }
    }

    static async refreshToken(req, res) {
        try {
            const refreshToken = req.cookies.refreshToken;
            if (!refreshToken) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const result = await AuthService.refreshToken(refreshToken, res);

            logger.info('Token refresh successful', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: result.user?.userID || null,
                metadata: { message: result.user?.message }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            logger.error('Token refresh failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 400,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: null,
                metadata: { error: response.error }
            });

            return res.status(400).json(response);
        }
    }

    static async logout(req, res) {
        try {
            const refreshToken = req.cookies?.refreshToken;
            const userId = req.user?.userID;
            const result = await AuthService.logout(refreshToken, userId);

            const cookieOptions = {
                path: '/',
                sameSite: process.env.NODE_ENV === 'development' ? 'Lax' : 'Strict',
                secure: process.env.NODE_ENV === 'production',
            };

            result.cookiesToClear.forEach(cookie => {
                res.clearCookie(cookie, cookieOptions);
            });

            const response = {
                message: result.message,
                keycloakLogoutUrl: result.keycloakLogoutUrl,
            };

            logger.info('User logout successful', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: userId || null,
                metadata: { message: response.message }
            });

            return res.status(200).json(response);
        } catch (error) {
            const response = { error: error.message || 'Logout failed' };

            logger.error('User logout failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 500,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: null,
                metadata: { error: response.error }
            });

            return res.status(500).json(response);
        }
    }

    static async resend2FA(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const { userID, otpMethod } = req.body;
            if (!userID) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const result = await AuthService.resend2FA(userID, otpMethod);

            logger.info('2FA code resent successfully', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: userID,
                metadata: { message: result.message }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            logger.error('2FA code resend failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 400,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.body.userID || null,
                metadata: { error: response.error }
            });

            return res.status(400).json(response);
        }
    }

    static async initiatePasswordReset(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const { identifier } = req.body;
            if (!identifier) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const result = await AuthService.initiatePasswordReset(identifier);

            logger.info('Password reset initiated successfully', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: result.userID,
                metadata: { message: result.message }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            logger.error('Password reset initiation failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 400,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: null,
                metadata: { error: response.error }
            });

            return res.status(400).json(response);
        }
    }

    static async verifyPasswordResetOTP(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const { userID, otpCode } = req.body;
            if (!userID || !otpCode) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const result = await AuthService.verifyPasswordResetOTP(userID, otpCode);

            logger.info('Password reset OTP verified successfully', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: userID,
                metadata: { message: result.message }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            logger.error('Password reset OTP verification failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 400,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.body.userID || null,
                metadata: { error: response.error }
            });

            return res.status(400).json(response);
        }
    }

    static async resetPassword(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const { userID, newPassword, tempToken } = req.body;
            if (!userID || !newPassword || !tempToken) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const result = await AuthService.resetPassword(userID, newPassword, tempToken);

            logger.info('Password reset completed successfully', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: userID,
                metadata: { message: result.message }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            logger.error('Password reset failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 400,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.body.userID || null,
                metadata: { error: response.error }
            });

            return res.status(400).json(response);
        }
    }
}

module.exports = AuthController;