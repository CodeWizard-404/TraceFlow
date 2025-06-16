const { validationResult } = require('express-validator');
const AuthService = require('../services/authService');
const GoogleAuthService = require('../services/googleAuthService');
const NodeCache = require('node-cache');
const { logRequest } = require('../utils/controllerUtils');

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

            logRequest({
                req,
                res: response,
                status: 302,
                message: 'Google login completed successfully',
                level: 'info',
                metadata: {
                    redirectUrl: response.redirect.substring(0, 100),
                    userEmail: result.user?.email,
                    userId: result.user?.userID || null,
                },
                service: 'auth',
                defaultRoute: 'auth',
            });

            setTimeout(() => {
                res.redirect(`${process.env.FRONTEND_URL}/?login=success`);
            }, 100);
        } catch (error) {
            const errorMessage = encodeURIComponent(error.message || 'Google login failed');

            logRequest({
                req,
                error,
                status: 302,
                message: `Google login callback failed: ${errorMessage}`,
                level: 'error',
                metadata: { error: errorMessage },
                service: 'auth',
                defaultRoute: 'auth',
            });

            res.redirect(`${process.env.FRONTEND_URL}/login?error=${errorMessage}`);
        }
    }

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

            logRequest({
                req,
                res: { authUrl },
                status: 302,
                message: 'Generated Google Calendar auth URL',
                level: 'info',
                metadata: { userId: req.user.userID, authUrl },
                service: 'auth',
                defaultRoute: 'auth',
            });

            res.redirect(authUrl);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Google calendar auth failed: ${error.message}`,
                level: 'error',
                metadata: { error: error.message },
                service: 'auth',
                defaultRoute: 'auth',
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
            const response = { redirect: `${process.env.FRONTEND_URL}/?calendar=success` };

            logRequest({
                req,
                res: response,
                status: 302,
                message: 'Google calendar login completed successfully',
                level: 'info',
                metadata: {
                    redirectUrl: response.redirect.substring(0, 100),
                    userEmail: result.user?.email,
                    userId: state || null,
                    hasRefreshToken: !!result.refreshToken,
                },
                service: 'auth',
                defaultRoute: 'auth',
            });

            setTimeout(() => {
                res.redirect(`${process.env.FRONTEND_URL}/?calendar=success`);
            }, 100);
        } catch (error) {
            const errorMessage = encodeURIComponent(error.message || 'Google calendar login failed');

            logRequest({
                req,
                error,
                status: 302,
                message: `Google calendar login callback failed: ${errorMessage}`,
                level: 'error',
                metadata: { error: errorMessage },
                service: 'auth',
                defaultRoute: 'auth',
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

            logRequest({
                req,
                res: { authUrl },
                status: 200,
                message: 'Retrieved Google Calendar auth URL',
                level: 'info',
                metadata: { userId: req.user.userID, authUrl },
                service: 'auth',
                defaultRoute: 'auth',
            });

            res.json({ authUrl });
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to get Google Calendar auth URL: ${error.message}`,
                level: 'error',
                metadata: { error: error.message },
                service: 'auth',
                defaultRoute: 'auth',
            });

            res.status(500).json({ error: 'Failed to get authorization URL' });
        }
    }

    static async googleIdTokenLogin(req, res) {
        try {
            const { id_token } = req.body;
            if (!id_token) throw new Error('Missing ID token');

            const result = await GoogleAuthService.googleIdTokenLogin(id_token, res);

            logRequest({
                req,
                res: result,
                status: 200,
                message: 'Google ID token login successful',
                level: 'info',
                metadata: {
                    userEmail: result.user?.email,
                    userId: result.user?.userID || null,
                },
                service: 'auth',
                defaultRoute: 'auth',
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            logRequest({
                req,
                error,
                status: 400,
                message: `Google ID token login failed: ${response.error}`,
                level: 'error',
                metadata: { error: response.error },
                service: 'auth',
                defaultRoute: 'auth',
            });

            return res.status(400).json(response);
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
                const response = {
                    accessToken: session.token,
                    user: { userID: userId, email: identifier },
                    expiresIn: 900000,
                };

                logRequest({
                    req,
                    res: response,
                    status: 200,
                    message: 'Session found, reusing existing session',
                    level: 'info',
                    metadata: { userId },
                    service: 'auth',
                    defaultRoute: 'auth',
                });

                return res.status(200).json(response);
            }

            const result = await AuthService.login(identifier, password, deviceIdentifier, otpMethod, res);

            logRequest({
                req,
                res: result,
                status: 200,
                message: 'User login successful',
                level: 'info',
                metadata: {
                    userId: result.user?.userID || null,
                    requires2FA: result.requires2FA,
                    email: result.user?.email || null,
                },
                service: 'auth',
                defaultRoute: 'auth',
            });

            return res.status(200).json(result);
        } catch (error) {
            const status = error.message === ERROR_MESSAGES.INVALID_CREDENTIALS ? 401 : 400;
            const response = AuthController.formatError(error);

            logRequest({
                req,
                error,
                status,
                message: `User login failed: ${response.error}`,
                level: 'error',
                metadata: { error: response.error },
                service: 'auth',
                defaultRoute: 'auth',
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
            if (cachedResult) {
                logRequest({
                    req,
                    res: cachedResult,
                    status: 200,
                    message: 'Returning cached 2FA result',
                    level: 'info',
                    metadata: { userId: userID, deviceIdentifier },
                    service: 'auth',
                    defaultRoute: 'auth',
                });

                return res.status(200).json(cachedResult);
            }

            const result = await AuthService.verify2FA(userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken, res);
            cache.set(cacheKey, result, 60);

            logRequest({
                req,
                res: result,
                status: 200,
                message: '2FA verification successful',
                level: 'info',
                metadata: {
                    userId: userID,
                    email: result.user?.email,
                    trustDevice,
                },
                service: 'auth',
                defaultRoute: 'auth',
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            logRequest({
                req,
                error,
                status: 400,
                message: `2FA verification failed: ${response.error}`,
                level: 'error',
                metadata: { error: response.error },
                service: 'auth',
                defaultRoute: 'auth',
            });

            return res.status(400).json(response);
        }
    }

    static async refreshToken(req, res) {
        try {
            const refreshToken = req.cookies.refreshToken;
            if (!refreshToken) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const result = await AuthService.refreshToken(refreshToken, res);

            logRequest({
                req,
                res: result,
                status: 200,
                message: 'Token refresh successful',
                level: 'info',
                metadata: {
                    userId: result.user?.userID || null,
                    message: result.user?.message,
                },
                service: 'auth',
                defaultRoute: 'auth',
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            logRequest({
                req,
                error,
                status: 400,
                message: `Token refresh failed: ${response.error}`,
                level: 'error',
                metadata: { error: response.error },
                service: 'auth',
                defaultRoute: 'auth',
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

            logRequest({
                req,
                res: response,
                status: 200,
                message: 'User logout successful',
                level: 'info',
                metadata: {
                    userId: userId || null,
                    message: response.message,
                },
                service: 'auth',
                defaultRoute: 'auth',
            });

            return res.status(200).json(response);
        } catch (error) {
            const response = { error: error.message || 'Logout failed' };

            logRequest({
                req,
                error,
                status: 500,
                message: `User logout failed: ${response.error}`,
                level: 'error',
                metadata: { error: response.error },
                service: 'auth',
                defaultRoute: 'auth',
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

            logRequest({
                req,
                res: result,
                status: 200,
                message: '2FA code resent successfully',
                level: 'info',
                metadata: {
                    userId: userID,
                    message: result.message,
                },
                service: 'auth',
                defaultRoute: 'auth',
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            logRequest({
                req,
                error,
                status: 400,
                message: `2FA code resend failed: ${response.error}`,
                level: 'error',
                metadata: { error: response.error },
                service: 'auth',
                defaultRoute: 'auth',
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

            logRequest({
                req,
                res: result,
                status: 200,
                message: 'Password reset initiated successfully',
                level: 'info',
                metadata: {
                    userId: result.userID,
                    message: result.message,
                },
                service: 'auth',
                defaultRoute: 'auth',
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            logRequest({
                req,
                error,
                status: 400,
                message: `Password reset initiation failed: ${response.error}`,
                level: 'error',
                metadata: { error: response.error },
                service: 'auth',
                defaultRoute: 'auth',
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

            logRequest({
                req,
                res: result,
                status: 200,
                message: 'Password reset OTP verified successfully',
                level: 'info',
                metadata: {
                    userId: userID,
                    message: result.message,
                },
                service: 'auth',
                defaultRoute: 'auth',
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            logRequest({
                req,
                error,
                status: 400,
                message: `Password reset OTP verification failed: ${response.error}`,
                level: 'error',
                metadata: { error: response.error },
                service: 'auth',
                defaultRoute: 'auth',
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

            logRequest({
                req,
                res: result,
                status: 200,
                message: 'Password reset completed successfully',
                level: 'info',
                metadata: {
                    userId: userID,
                    message: result.message,
                },
                service: 'auth',
                defaultRoute: 'auth',
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            logRequest({
                req,
                error,
                status: 400,
                message: `Password reset failed: ${response.error}`,
                level: 'error',
                metadata: { error: response.error },
                service: 'auth',
                defaultRoute: 'auth',
            });

            return res.status(400).json(response);
        }
    }
}

module.exports = AuthController;