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
};

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';

class AuthController {
    static formatError(error) {
        const response = {
            error: error.message || ERROR_MESSAGES.SERVER_ERROR,
        };
        if (error.waitTime) response.waitTime = error.waitTime;
        if (error.failureCount !== undefined) response.failureCount = error.failureCount;
        return response;
    }

    static async initiateGoogleLogin(req, res) {
        try {
            const authUrl = await GoogleAuthService.getAuthUrl();
            logger.info(`Initiated Google OAuth login for user ${req.user?.userID || 'unknown'}, IP: ${req.ip}`);
            return res.redirect(authUrl);
        } catch (error) {
            logger.error(`Initiate Google OAuth error: ${error.message}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Failed to initiate Google login' });
        }
    }

    static async googleCallback(req, res) {
        try {
            res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL);
            res.setHeader('Access-Control-Allow-Credentials', 'true');

            const { code, state } = req.query;
            if (!code) {
                logger.warn('Google callback: Missing code parameter', { query: req.query, IP: req.ip });
                return res.redirect(`${process.env.FRONTEND_URL}/login?error=Missing+code+parameter`);
            }

            const deviceIdentifier = req.headers['x-device-id'] || 'unknown-device';
            const result = await GoogleAuthService.googleLogin(code, deviceIdentifier, res);
            logger.info(`Google login successful for user ${result.user?.userID || 'unknown'}, IP: ${req.ip}`);

            const cookieHeaders = res.getHeader('Set-Cookie') || [];
            const userDataCookie = cookieHeaders.find(header => header.startsWith('userData='));
            logger.info('Cookies set in response', {
                cookies: cookieHeaders,
                userDataCookiePreview: userDataCookie ? userDataCookie.substring(0, 100) + '...' : 'Not found',
            });

            setTimeout(() => {
                res.redirect(`${process.env.FRONTEND_URL}/?login=success`);
            }, 100);
        } catch (error) {
            logger.error(`Google callback error: ${error.message}`, {
                status: error.status,
                stack: error.stack,
                query: req.query,
                IP: req.ip,
            });
            const errorMessage = encodeURIComponent(error.message || 'Google login failed');
            res.redirect(`${process.env.FRONTEND_URL}/login?error=${errorMessage}`);
        }
    }

    static async reauthenticate(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`Reauthentication validation failed: ${JSON.stringify(errors.array())}`, { IP: req.ip });
                return res.status(400).json({ error: 'Missing required fields', details: errors.array() });
            }

            const { username, password, client_id, tab_id, client_data } = req.body;

            const keycloakResponse = await axios.post(
                `${KEYCLOAK_URL}/realms/${REALM}/login-actions/authenticate`,
                new URLSearchParams({
                    client_id,
                    tab_id,
                    username,
                    password,
                    client_data,
                }),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    maxRedirects: 0,
                }
            ).catch(async (error) => {
                if (error.response && error.response.status === 302) {
                    const redirectUrl = error.response.headers.location;
                    logger.info(`Reauthentication successful, redirecting to: ${redirectUrl}`);
                    return { data: { redirectUrl } };
                }
                logger.error(`Reauthentication failed: ${error.message}`, { status: error.response?.status });
                throw new Error('Invalid credentials');
            });

            if (keycloakResponse.data.redirectUrl) {
                return res.redirect(keycloakResponse.data.redirectUrl);
            }

            logger.error('Unexpected Keycloak response', { response: keycloakResponse.data });
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=reauth_failed`);
        } catch (error) {
            logger.error(`Reauthentication error: ${error.message}`, { IP: req.ip });
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=reauth_failed`);
        }
    }

    static async login(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`Login validation failed: ${JSON.stringify(errors.array())}, IP: ${req.ip}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { identifier, password, deviceIdentifier, otpMethod } = req.body;
            if (!identifier || !password || !deviceIdentifier) {
                logger.warn('Missing login fields, IP: ${req.ip}');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }

            const result = await AuthService.login(identifier, password, deviceIdentifier, otpMethod, res);
            logger.info(`Login successful for ${identifier}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Login error for ${req.body.identifier || 'unknown'}: ${error.message}, IP: ${req.ip}`);
            const status = error.message === ERROR_MESSAGES.INVALID_CREDENTIALS ? 401 : 400;
            return res.status(status).json(AuthController.formatError(error));
        }
    }

    static async verify2FA(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`2FA validation failed: ${JSON.stringify(errors.array())}, IP: ${req.ip}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken } = req.body;
            if (!userID || !otpCode || !deviceIdentifier || trustDevice === undefined || !tempToken || !refreshToken) {
                logger.warn('Missing 2FA fields, IP: ${req.ip}');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }

            const cacheKey = `2fa_${userID}_${deviceIdentifier}`;
            const cachedResult = cache.get(cacheKey);
            if (cachedResult) {
                return res.status(200).json(cachedResult);
            }

            const result = await AuthService.verify2FA(userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken, res);
            cache.set(cacheKey, result, 60);
            logger.info(`2FA verified for user ${userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`2FA verification error for ${req.body.userID || 'unknown'}: ${error.message}, IP: ${req.ip}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    static async refreshToken(req, res) {
        try {
            const refreshToken = req.cookies.refreshToken;
            if (!refreshToken) {
                logger.warn('No refresh token provided, IP: ${req.ip}');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.refreshToken(refreshToken, res);
            logger.info('Refresh token successful, IP: ${req.ip}');
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Refresh token error: ${error.message}, IP: ${req.ip}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    static async logout(req, res) {
        try {
            const refreshToken = req.cookies?.refreshToken;
            const result = await AuthService.logout(refreshToken);

            const cookieOptions = {
                path: '/',
                sameSite: process.env.NODE_ENV === 'development' ? 'Lax' : 'Strict',
                secure: process.env.NODE_ENV === 'production',
            };

            result.cookiesToClear.forEach(cookie => {
                res.clearCookie(cookie, cookieOptions);
            });
            logger.info('Cookies cleared on logout', { cookies: result.cookiesToClear, IP: req.ip });

            logger.info('User logged out successfully', { IP: req.ip });
            return res.status(200).json({
                message: result.message,
                keycloakLogoutUrl: result.keycloakLogoutUrl,
            });
        } catch (error) {
            logger.error(`Logout error: ${error.message}`, { IP: req.ip, stack: error.stack });
            return res.status(500).json({ error: error.message || 'Logout failed' });
        }
    }

    static async resend2FA(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`Resend 2FA validation failed: ${JSON.stringify(errors.array())}, IP: ${req.ip}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { userID, otpMethod } = req.body;
            if (!userID) {
                logger.warn('Missing userID for resend 2FA, IP: ${req.ip}');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.resend2FA(userID, otpMethod);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Resend 2FA error for ${req.body.userID || 'unknown'}: ${error.message}, IP: ${req.ip}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    static async initiatePasswordReset(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`Password reset init validation failed: ${JSON.stringify(errors.array())}, IP: ${req.ip}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { identifier } = req.body;
            if (!identifier) {
                logger.warn('Missing identifier for password reset, IP: ${req.ip}');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.initiatePasswordReset(identifier);
            logger.info(`Password reset initiated for ${identifier}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Password reset init error for ${req.body.identifier || 'unknown'}: ${error.message}, IP: ${req.ip}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    static async verifyPasswordResetOTP(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`Password reset OTP validation failed: ${JSON.stringify(errors.array())}, IP: ${req.ip}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { userID, otpCode } = req.body;
            if (!userID || !otpCode) {
                logger.warn('Missing fields for password reset OTP, IP: ${req.ip}');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.verifyPasswordResetOTP(userID, otpCode);
            logger.info(`Password reset OTP verified for ${userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Password reset OTP error for ${req.body.userID || 'unknown'}: ${error.message}, IP: ${req.ip}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    static async resetPassword(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`Password reset validation failed: ${JSON.stringify(errors.array())}, IP: ${req.ip}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { userID, newPassword, tempToken } = req.body;
            if (!userID || !newPassword || !tempToken) {
                logger.warn('Missing fields for password reset, IP: ${req.ip}');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.resetPassword(userID, newPassword, tempToken);
            logger.info(`Password reset completed for ${userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Password reset error for ${req.body.userID || 'unknown'}: ${error.message}, IP: ${req.ip}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }
}

module.exports = AuthController;