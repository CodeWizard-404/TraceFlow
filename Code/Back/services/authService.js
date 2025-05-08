const axios = require('axios');
const { nanoid } = require('nanoid');
const { User, Role, Permission, TrustedDevice } = require('../models');
const otpService = require('./otpService');
const { transporter } = require('../config/smtp');
const { sendSMS } = require('../config/sms');
const logger = require('../utils/logger');
require('dotenv').config();

const ERROR_MESSAGES = {
    INVALID_CREDENTIALS: 'Wrong email or password.',
    USER_NOT_FOUND: 'Account not found.',
    KEYCLOAK_MISMATCH: 'Account issue. Contact support.',
    NO_OTP_METHOD: 'No phone or email set for OTP.',
    OTP_SEND_FAILED: 'Couldn’t send OTP. Try again.',
    INVALID_OTP: 'Wrong or expired OTP.',
    INVALID_REFRESH_TOKEN: 'Can’t refresh session. Log in again.',
    PASSWORD_RESET_FAILED: 'Couldn’t start password reset. Try again.',
    PASSWORD_UPDATE_FAILED: 'Couldn’t update password. Try again.',
    KEYCLOAK_UNAVAILABLE: 'Authentication service down. Try again.',
    KEYCLOAK_USER_NOT_FOUND: 'Account not found in system.',
    KEYCLOAK_ADMIN_TOKEN_FAILED: 'Server issue. Try again.',
    DATABASE_ERROR: 'Database issue. Try again.',
    MISSING_FIELDS: 'Missing required fields for 2FA verification.',
    INVALID_KEYCLOAK_RESPONSE: 'Authentication failed. Please try again.',
    ACCOUNT_LOCKED: 'Account temporarily locked due to too many failed attempts.',
    TOO_MANY_ATTEMPTS: 'Too many login attempts. Please wait before trying again.',
    GOOGLE_LOGIN_FAILED: 'Google login failed. Ensure your account is registered.',
    INVALID_GOOGLE_CODE: 'Invalid Google authorization code.',
};

const verificationCache = new Map();
const CACHE_TTL = 5000;

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || '';
const ACCESS_TOKEN_MAX_AGE = parseInt(process.env.ACCESS_TOKEN_MAX_AGE) || 900000; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = parseInt(process.env.REFRESH_TOKEN_MAX_AGE) || 86400000; // 1 day

class AuthService {
    static async getKeycloakAdminToken() {
        try {
            const response = await axios.post(
                `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: 'password',
                    client_id: 'admin-cli',
                    username: process.env.KEYCLOAK_KEYCLOAK_ADMIN_USER || 'admin',
                    password: process.env.KEYCLOAK_KEYCLOAK_ADMIN_PASSWORDWORD || 'admin',
                })
            );
            return response.data.access_token;
        } catch (error) {
            logger.error(`Keycloak admin token error: ${error.message}`);
            throw Object.assign(new Error(ERROR_MESSAGES.KEYCLOAK_ADMIN_TOKEN_FAILED), { status: 503 });
        }
    }

    static async syncKeycloakUser(identifier, keycloakId) {
        try {
            let user = await User.findOne({ where: { email: identifier } });
            if (!user) {
                user = await User.create({
                    userID: `usr_${nanoid()}`,
                    keycloakId,
                    email: identifier,
                    firstname: 'Unknown',
                    lastname: 'User',
                    phone: 'N/A',
                    password: 'KEYCLOAK_MANAGED',
                });
            } else if (!user.keycloakId) {
                await user.update({ keycloakId });
            } else if (user.keycloakId !== keycloakId) {
                throw new Error(ERROR_MESSAGES.KEYCLOAK_MISMATCH);
            }
            return user;
        } catch (error) {
            logger.error(`Sync user error for ${identifier}: ${error.message}`);
            throw error.message === ERROR_MESSAGES.KEYCLOAK_MISMATCH
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.DATABASE_ERROR), { status: 500 });
        }
    }

    static async googleLogin(code, deviceIdentifier, res) {
        try {
            logger.info('Initiating Google login', { code, deviceIdentifier });

            // Exchange Google code for Keycloak tokens
            const tokenResponse = await axios.post(
                `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    code,
                    redirect_uri: process.env.BACKEND_REDIRECT_URI
                }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            ).catch(error => {
                logger.error('Keycloak token exchange failed', {
                    status: error.response?.status,
                    data: error.response?.data,
                    message: error.message,
                });
                throw error;
            });

            const { access_token, refresh_token, expires_in } = tokenResponse.data;
            if (!access_token || !refresh_token || !expires_in) {
                logger.error('Invalid Keycloak token response', { response: tokenResponse.data });
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_GOOGLE_CODE), { status: 400 });
            }
            logger.info('Keycloak tokens obtained', { expires_in });

            // Introspect token to get user info
            const introspectResponse = await axios.post(
                `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token/introspect`,
                new URLSearchParams({
                    token: access_token,
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            ).catch(error => {
                logger.error('Token introspection failed', {
                    status: error.response?.status,
                    data: error.response?.data,
                    message: error.message,
                });
                throw error;
            });

            if (!introspectResponse.data.active) {
                logger.error('Token is not active', { response: introspectResponse.data });
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_GOOGLE_CODE), { status: 400 });
            }

            const { email, sub: keycloakId, username } = introspectResponse.data;
            if (!email || !username) {
                logger.error('Missing email or username in token introspection', { response: introspectResponse.data });
                throw Object.assign(new Error(ERROR_MESSAGES.GOOGLE_LOGIN_FAILED), { status: 400 });
            }
            logger.info('User info retrieved from token', { email, username, keycloakId });

            // Find user by googleEmail (which matches email and username)
            const user = await User.findOne({
                where: { email },
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
                logger.warn(`Google login failed: No user found with googleEmail ${email}`);
                throw Object.assign(new Error(ERROR_MESSAGES.GOOGLE_LOGIN_FAILED), { status: 404 });
            }
            logger.info('User found in database', { userID: user.userID, keycloakId: user.keycloakId });

            // Verify keycloakId matches
            if (!user.keycloakId) {
                await user.update({ keycloakId });
                logger.info(`Updated keycloakId for user ${user.userID} to ${keycloakId}`);
            } else if (user.keycloakId !== keycloakId) {
                logger.warn(`Keycloak ID mismatch for user ${email}`, {
                    databaseKeycloakId: user.keycloakId,
                    tokenKeycloakId: keycloakId,
                });
                throw Object.assign(new Error(ERROR_MESSAGES.KEYCLOAK_MISMATCH), { status: 400 });
            }

            // Check if the device is trusted
            const trustedDevice = await TrustedDevice.findOne({
                where: { userID: user.userID, deviceIdentifier, status: 'active' },
            });

            if (trustedDevice) {
                await trustedDevice.update({ lastUsed: new Date() });
                logger.info('Trusted device found, completing login', { deviceIdentifier });
                return this.generateLoginResponse(user, access_token, refresh_token, expires_in, res);
            }

            // Generate and send OTP for 2FA
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const phoneRegex = /^\+?\d{8,11}$/;
            const hasValidEmail = user.email && emailRegex.test(user.email);
            const hasValidPhone = user.phone && user.phone !== 'N/A' && phoneRegex.test(user.phone);

            if (!hasValidEmail && !hasValidPhone) {
                logger.error(`No valid OTP method for ${user.userID}`);
                throw Object.assign(new Error(ERROR_MESSAGES.NO_OTP_METHOD), { status: 400 });
            }

            let otp;
            let selectedMethod = 'email';

            if (hasValidEmail) {
                try {
                    otp = await otpService.generateOTP(user.userID, 'user');
                    await transporter.sendMail({
                        from: process.env.SMTP_USER,
                        to: user.email,
                        subject: 'TraceFlow 2FA OTP',
                        text: `Your OTP is ${otp.code}. It expires in 10 minutes.`,
                    });
                    logger.info(`OTP sent to email for ${user.userID}`);
                } catch (error) {
                    logger.error(`Email OTP send failed for ${user.userID}: ${error.message}`);
                    if (hasValidPhone) {
                        selectedMethod = 'phone';
                    } else {
                        throw Object.assign(new Error(ERROR_MESSAGES.OTP_SEND_FAILED), { status: 500 });
                    }
                }
            }

            if (!otp && hasValidPhone) {
                try {
                    otp = await otpService.generateOTP(user.userID, 'user');
                    const smsResult = await sendSMS(user.phone, `Your TraceFlow OTP is ${otp.code}`, 'otp');
                    if (!smsResult.success) {
                        logger.error(`SMS OTP send failed for ${user.userID}: ${smsResult.reason}`);
                        if (hasValidEmail) {
                            selectedMethod = 'email';
                            otp = await otpService.generateOTP(user.userID, 'user');
                            await transporter.sendMail({
                                from: process.env.SMTP_USER,
                                to: user.email,
                                subject: 'TraceFlow 2FA OTP',
                                text: `Your OTP is ${otp.code}. It expires in 10 minutes.`,
                            });
                            logger.info(`Fallback OTP sent to email for ${user.userID}`);
                        } else {
                            throw Object.assign(new Error(ERROR_MESSAGES.OTP_SEND_FAILED), { status: 500 });
                        }
                    } else {
                        selectedMethod = smsResult.fallback ? 'email' : 'phone';
                        logger.info(`OTP sent to phone for ${user.userID}`);
                    }
                } catch (error) {
                    logger.error(`SMS OTP send failed for ${user.userID}: ${error.message}`);
                    throw Object.assign(new Error(ERROR_MESSAGES.OTP_SEND_FAILED), { status: 500 });
                }
            }

            if (!otp) {
                logger.error(`OTP delivery failed for ${user.userID}`);
                throw Object.assign(new Error(ERROR_MESSAGES.OTP_SEND_FAILED), { status: 500 });
            }

            logger.info(`Google login requires 2FA for ${user.userID}`, { selectedMethod });
            return {
                requires2FA: true,
                userID: user.userID,
                deviceIdentifier,
                tempToken: access_token,
                refreshToken: refresh_token,
                expiresIn: expires_in * 1000,
                message: `OTP sent to your ${selectedMethod}`,
            };
        } catch (error) {
            logger.error(`Google login error: ${error.message}`, {
                status: error.response?.status,
                data: error.response?.data,
                stack: error.stack,
            });
            if (error.response?.data?.error === 'invalid_request' && error.response?.data?.error_description?.includes('Missing parameter: username')) {
                throw Object.assign(new Error('Google login failed: Missing username parameter'), { status: 400 });
            }
            throw error.status
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.GOOGLE_LOGIN_FAILED), { status: 400 });
        }
    }

    static async login(identifier, password, deviceIdentifier, otpMethod = 'email', res) {
        let loginResponse;
        try {
            loginResponse = await axios.post(
                `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: 'password',
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    username: identifier,
                    password,
                    scope: 'openid email profile roles',
                })
            );

            if (
                !loginResponse.data ||
                !loginResponse.data.access_token ||
                !loginResponse.data.refresh_token ||
                !loginResponse.data.expires_in
            ) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_KEYCLOAK_RESPONSE), { status: 400 });
            }
        } catch (error) {
            logger.error(`Keycloak login error for ${identifier}: ${error.message}`);
            if (error.response) {
                const { status, data } = error.response;
                if (status === 429) {
                    const waitTime = data.error_description?.match(/try again in (\d+) seconds/)?.[1] || 300;
                    throw Object.assign(new Error(ERROR_MESSAGES.TOO_MANY_ATTEMPTS), {
                        waitTime: parseInt(waitTime),
                        status: 429,
                    });
                }
                if (status === 403 && data.error_description?.includes('Account temporarily disabled')) {
                    const waitTime = data.error_description?.match(/try again in (\d+) seconds/)?.[1] || 900;
                    throw Object.assign(new Error(ERROR_MESSAGES.ACCOUNT_LOCKED), {
                        waitTime: parseInt(waitTime),
                        status: 403,
                    });
                }
                if (status === 401 || (status === 400 && data.error === 'invalid_grant')) {
                    throw Object.assign(new Error(ERROR_MESSAGES.INVALID_CREDENTIALS), {
                        failureCount: data.failure_count || 0,
                        status: 401,
                    });
                }
            }
            throw Object.assign(
                new Error(
                    error.message === ERROR_MESSAGES.INVALID_KEYCLOAK_RESPONSE
                        ? error.message
                        : ERROR_MESSAGES.INVALID_CREDENTIALS
                ),
                { status: 401 }
            );
        }

        let keycloakUserResponse;
        try {
            const adminToken = await this.getKeycloakAdminToken();
            keycloakUserResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=${identifier}&exact=true`,
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
            if (!keycloakUserResponse.data.length) {
                throw Object.assign(new Error(ERROR_MESSAGES.KEYCLOAK_USER_NOT_FOUND), { status: 404 });
            }
        } catch (error) {
            logger.error(`Keycloak user fetch error for ${identifier}: ${error.message}`);
            throw error.message === ERROR_MESSAGES.KEYCLOAK_USER_NOT_FOUND
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.KEYCLOAK_UNAVAILABLE), { status: 503 });
        }

        const keycloakId = keycloakUserResponse.data[0].id;
        const user = await this.syncKeycloakUser(identifier, keycloakId);

        const userWithDetails = await User.findOne({
            where: { keycloakId },
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

        if (!userWithDetails) {
            logger.error(`User details fetch failed for ${identifier}`);
            throw Object.assign(new Error(ERROR_MESSAGES.USER_NOT_FOUND), { status: 404 });
        }

        const trustedDevice = await TrustedDevice.findOne({
            where: { userID: user.userID, deviceIdentifier, status: 'active' },
        });
        if (trustedDevice) {
            await trustedDevice.update({ lastUsed: new Date() });
            return this.generateLoginResponse(
                userWithDetails,
                loginResponse.data.access_token,
                loginResponse.data.refresh_token,
                loginResponse.data.expires_in,
                res
            );
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^\+?\d{8,11}$/;
        const hasValidEmail = user.email && emailRegex.test(user.email);
        const hasValidPhone = user.phone && user.phone !== 'N/A' && phoneRegex.test(user.phone);

        if (!hasValidEmail && !hasValidPhone) {
            logger.error(`No valid OTP method for ${user.userID}`);
            throw Object.assign(new Error(ERROR_MESSAGES.NO_OTP_METHOD), { status: 400 });
        }

        try {
            let otp;
            let selectedMethod = otpMethod;
            let fallbackReason = null;

            if (selectedMethod === 'email' && hasValidEmail) {
                try {
                    otp = await otpService.generateOTP(user.userID, 'user');
                    await transporter.sendMail({
                        from: process.env.SMTP_USER,
                        to: user.email,
                        subject: 'TraceFlow 2FA OTP',
                        text: `Your OTP is ${otp.code}. It expires in 10 minutes.`,
                    });
                } catch (error) {
                    logger.error(`Email OTP send failed for ${user.userID}: ${error.message}`);
                    if (hasValidPhone) {
                        selectedMethod = 'phone';
                    } else {
                        throw Object.assign(new Error(ERROR_MESSAGES.OTP_SEND_FAILED), { status: 500 });
                    }
                }
            }
            if (!otp && selectedMethod === 'phone' && hasValidPhone) {
                try {
                    otp = await otpService.generateOTP(user.userID, 'user');
                    const smsResult = await sendSMS(user.phone, `Your TraceFlow OTP is ${otp.code}`, 'otp');
                    if (!smsResult.success) {
                        logger.error(`SMS OTP send failed for ${user.userID}: ${smsResult.reason}`);
                        if (hasValidEmail) {
                            selectedMethod = 'email';
                            fallbackReason = smsResult.fallbackReason || 'SMS delivery failed';
                            otp = await otpService.generateOTP(user.userID, 'user');
                            await transporter.sendMail({
                                from: process.env.SMTP_USER,
                                to: user.email,
                                subject: 'TraceFlow 2FA OTP',
                                text: `Your OTP is ${otp.code}. It expires in 10 minutes.`,
                            });
                        } else {
                            throw Object.assign(new Error(ERROR_MESSAGES.OTP_SEND_FAILED), { status: 500 });
                        }
                    } else {
                        selectedMethod = smsResult.fallback ? 'email' : 'phone';
                        fallbackReason = smsResult.fallbackReason || null;
                    }
                } catch (error) {
                    logger.error(`SMS OTP send failed for ${user.userID}: ${error.message}`);
                    throw Object.assign(new Error(ERROR_MESSAGES.OTP_SEND_FAILED), { status: 500 });
                }
            }

            if (!otp) {
                logger.error(`OTP delivery failed for ${user.userID}`);
                throw Object.assign(new Error(ERROR_MESSAGES.OTP_SEND_FAILED), { status: 500 });
            }

            return {
                requires2FA: true,
                userID: user.userID,
                deviceIdentifier,
                tempToken: loginResponse.data.access_token,
                refreshToken: loginResponse.data.refresh_token,
                expiresIn: loginResponse.data.expires_in * 1000,
                message: `OTP sent to your ${selectedMethod}${fallbackReason ? ` due to: ${fallbackReason}` : ''}`,
            };
        } catch (error) {
            logger.error(`OTP error for ${identifier}: ${error.message}`);
            throw error.message === ERROR_MESSAGES.NO_OTP_METHOD
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.OTP_SEND_FAILED), { status: 500 });
        }
    }

    static async verify2FA(userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken, res) {
        const missingFields = [];
        if (!userID) missingFields.push('userID');
        if (!otpCode) missingFields.push('otpCode');
        if (!deviceIdentifier) missingFields.push('deviceIdentifier');
        if (trustDevice === undefined) missingFields.push('trustDevice');
        if (!tempToken) missingFields.push('tempToken');
        if (!refreshToken) missingFields.push('refreshToken');

        if (missingFields.length > 0) {
            logger.error(`2FA verification failed: Missing fields: ${missingFields.join(', ')}`);
            throw Object.assign(new Error(`${ERROR_MESSAGES.MISSING_FIELDS} Missing: ${missingFields.join(', ')}`), {
                status: 400,
            });
        }

        const cacheKey = `${userID}:${otpCode}:${deviceIdentifier}`;
        const cachedResult = verificationCache.get(cacheKey);
        if (cachedResult) {
            logger.info(`2FA cache hit for ${userID}`);
            return cachedResult;
        }

        const user = await User.findByPk(userID);
        if (!user) {
            logger.error(`2FA verification failed: User ${userID} not found`);
            throw Object.assign(new Error(ERROR_MESSAGES.USER_NOT_FOUND), { status: 404 });
        }

        try {
            await otpService.validateOTP(user.userID, otpCode, 'user');
        } catch (error) {
            logger.error(`2FA OTP validation failed for ${userID}: ${error.message}`);
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_OTP), { status: 400 });
        }

        const userWithDetails = await User.findOne({
            where: { userID },
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

        if (trustDevice) {
            const existingDevice = await TrustedDevice.findOne({
                where: { userID, deviceIdentifier },
            });
            if (existingDevice) {
                await existingDevice.update({ status: 'active', lastUsed: new Date() });
            } else {
                await TrustedDevice.create({
                    userID,
                    deviceIdentifier,
                    status: 'active',
                    lastUsed: new Date(),
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                });
            }
        }

        const result = this.generateLoginResponse(userWithDetails, tempToken, refreshToken, 900, res);
        verificationCache.set(cacheKey, result);
        setTimeout(() => verificationCache.delete(cacheKey), CACHE_TTL);

        return result;
    }

    static async refreshToken(refreshToken, res) {
        try {
            logger.info('Initiating token refresh');
            const response = await axios.post(
                `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    refresh_token: refreshToken,
                })
            );

            if (!response.data || !response.data.access_token || !response.data.expires_in || !response.data.refresh_token) {
                logger.error('Invalid Keycloak refresh response', { response: response.data });
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_REFRESH_TOKEN), { status: 400 });
            }

            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'development' ? 'Lax' : 'Strict',
                path: '/',
            };

            res.cookie('accessToken', response.data.access_token, {
                ...cookieOptions,
                maxAge: ACCESS_TOKEN_MAX_AGE,
            });

            res.cookie('refreshToken', response.data.refresh_token, {
                ...cookieOptions,
                maxAge: REFRESH_TOKEN_MAX_AGE,
            });

            logger.info('Tokens refreshed successfully', {
                accessTokenExpiresIn: response.data.expires_in,
                refreshTokenRotatedAt: new Date().toISOString(),
            });

            return {
                user: { message: 'Token refreshed' },
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiresIn: response.data.expires_in * 1000,
            };
        } catch (error) {
            logger.error(`Token refresh failed: ${error.message}`, {
                status: error.response?.status,
                data: error.response?.data,
            });
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_REFRESH_TOKEN), { status: 400 });
        }
    }

    static generateLoginResponse(user, token, refreshToken, expiresIn, res) {
        if (!user || !token || !refreshToken || !expiresIn) {
            logger.error(`Invalid login response data for user ${user?.userID || 'unknown'}`);
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_KEYCLOAK_RESPONSE), { status: 400 });
        }

        const roles = user.Roles?.map((role) => ({
            roleID: role.roleID,
            name: role.name,
            description: role.description || undefined,
            permissions: role.Permissions
                ? role.Permissions.map((p) => ({
                    permissionID: p.permissionID,
                    name: p.name,
                    class: p.class,
                    description: p.description || undefined,
                }))
                : [],
        })) || [];

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'development' ? 'Lax' : 'Strict',
            path: '/',
        };

        res.cookie('accessToken', token, {
            ...cookieOptions,
            maxAge: ACCESS_TOKEN_MAX_AGE,
        });
        res.cookie('refreshToken', refreshToken, {
            ...cookieOptions,
            maxAge: REFRESH_TOKEN_MAX_AGE,
        });

        return {
            requires2FA: false,
            accessToken: token,
            user: {
                userID: user.userID,
                email: user.email,
                phone: user.phone,
                roles,
            },
            expiresIn: expiresIn * 1000,
        };
    }

    static async resend2FA(userID, otpMethod = 'email') {
        const user = await User.findByPk(userID);
        if (!user) {
            logger.error(`Resend 2FA failed: User ${userID} not found`);
            throw Object.assign(new Error(ERROR_MESSAGES.USER_NOT_FOUND), { status: 404 });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^\+?\d{8,11}$/;
        const hasValidEmail = user.email && emailRegex.test(user.email);
        const hasValidPhone = user.phone && user.phone !== 'N/A' && phoneRegex.test(user.phone);

        if (!hasValidEmail && !hasValidPhone) {
            logger.error(`No valid OTP method for ${userID}`);
            throw Object.assign(new Error(ERROR_MESSAGES.NO_OTP_METHOD), { status: 400 });
        }

        try {
            let otp;
            let selectedMethod = otpMethod;
            let fallbackReason = null;

            if (selectedMethod === 'email' && hasValidEmail) {
                otp = await otpService.generateOTP(userID, 'user');
                await transporter.sendMail({
                    from: process.env.SMTP_USER,
                    to: user.email,
                    subject: 'TraceFlow OTP',
                    text: `Your OTP is ${otp.code}. It expires in 10 minutes.`,
                });
            } else if (selectedMethod === 'phone' && hasValidPhone) {
                otp = await otpService.generateOTP(userID, 'user');
                const smsResult = await sendSMS(user.phone, `Your TraceFlow OTP is ${otp.code}`, 'otp');
                if (!smsResult.success) {
                    logger.error(`SMS resend failed for ${userID}: ${smsResult.reason}`);
                    if (hasValidEmail) {
                        selectedMethod = 'email';
                        fallbackReason = smsResult.fallbackReason || 'SMS delivery failed';
                        otp = await otpService.generateOTP(userID, 'user');
                        await transporter.sendMail({
                            from: process.env.SMTP_USER,
                            to: user.email,
                            subject: 'TraceFlow OTP',
                            text: `Your OTP is ${otp.code}. It expires in 10 minutes.`,
                        });
                    } else {
                        throw Object.assign(new Error(ERROR_MESSAGES.OTP_SEND_FAILED), { status: 500 });
                    }
                } else {
                    selectedMethod = smsResult.fallback ? 'email' : 'phone';
                    fallbackReason = smsResult.fallbackReason || null;
                }
            } else {
                logger.error(`Invalid OTP method for ${userID}: ${otpMethod}`);
                throw Object.assign(new Error(ERROR_MESSAGES.NO_OTP_METHOD), { status: 400 });
            }

            logger.info(`OTP resent to ${userID} via ${selectedMethod}`);
            logger.info(`OTP: ${otp.code}`);
            return {
                userID,
                message: `OTP resent to your ${selectedMethod}${fallbackReason ? ` due to: ${fallbackReason}` : ''}`,
            };
        } catch (error) {
            logger.error(`Resend OTP error for ${userID}: ${error.message}`);
            throw error.message === ERROR_MESSAGES.NO_OTP_METHOD
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.OTP_SEND_FAILED), { status: 500 });
        }
    }

    static async initiatePasswordReset(identifier) {
        let keycloakId, user;
        try {
            const adminToken = await this.getKeycloakAdminToken();
            const userResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=${identifier}&exact=true`,
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
            if (!userResponse.data.length) {
                throw Object.assign(new Error(ERROR_MESSAGES.USER_NOT_FOUND), { status: 404 });
            }
            keycloakId = userResponse.data[0].id;
            user = await this.syncKeycloakUser(identifier, keycloakId);
        } catch (error) {
            logger.error(`Password reset init error for ${identifier}: ${error.message}`);
            throw error.message === ERROR_MESSAGES.USER_NOT_FOUND
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.KEYCLOAK_UNAVAILABLE), { status: 503 });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^\+?\d{8,11}$/;
        const hasValidEmail = user.email && emailRegex.test(user.email);
        const hasValidPhone = user.phone && user.phone !== 'N/A' && phoneRegex.test(user.phone);

        try {
            const otp = await otpService.generateOTP(user.userID, 'user');
            let selectedMethod = 'email';

            if (hasValidEmail) {
                await transporter.sendMail({
                    from: process.env.SMTP_USER,
                    to: user.email,
                    subject: 'TraceFlow Password Reset OTP',
                    text: `Your OTP for password reset is ${otp.code}. It expires in 10 minutes.`,
                });
            } else if (hasValidPhone) {
                const smsResult = await sendSMS(user.phone, `Your TraceFlow password reset OTP is ${otp.code}`, 'otp');
                if (!smsResult.success) {
                    logger.error(`SMS reset failed for ${user.userID}: ${smsResult.reason}`);
                    throw Object.assign(new Error(ERROR_MESSAGES.PASSWORD_RESET_FAILED), { status: 500 });
                }
                selectedMethod = smsResult.fallback ? 'email' : 'phone';
            } else {
                logger.error(`No valid OTP method for ${user.userID}`);
                throw Object.assign(new Error(ERROR_MESSAGES.NO_OTP_METHOD), { status: 400 });
            }

            logger.info(`Password reset OTP sent to ${user.userID} via ${selectedMethod}`);
            return { userID: user.userID, message: `OTP sent to your ${selectedMethod}` };
        } catch (error) {
            logger.error(`Password reset OTP error for ${user.userID}: ${error.message}`);
            throw error.message === ERROR_MESSAGES.NO_OTP_METHOD
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.PASSWORD_RESET_FAILED), { status: 500 });
        }
    }

    static async verifyPasswordResetOTP(userID, otpCode) {
        const user = await User.findByPk(userID);
        if (!user) {
            logger.error(`Password reset OTP verification failed: User ${userID} not found`);
            throw Object.assign(new Error(ERROR_MESSAGES.USER_NOT_FOUND), { status: 404 });
        }

        try {
            await otpService.validateOTP(user.userID, otpCode, 'user');
        } catch (error) {
            logger.error(`Password reset OTP validation failed for ${userID}: ${error.message}`);
            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_OTP), { status: 400 });
        }

        const tempToken = nanoid();
        await User.update({ tempResetToken: tempToken }, { where: { userID } });

        logger.info(`Password reset OTP verified for ${userID}`);
        return { userID, tempToken, message: 'OTP verified. Proceed to reset password.' };
    }

    static async resetPassword(userID, newPassword, tempToken) {
        const user = await User.findByPk(userID);
        if (!user) {
            logger.error(`Password reset failed: User ${userID} not found`);
            throw Object.assign(new Error(ERROR_MESSAGES.USER_NOT_FOUND), { status: 404 });
        }
        if (user.tempResetToken !== tempToken) {
            logger.error(`Password reset failed for ${userID}: Invalid reset token`);
            throw Object.assign(new Error('Invalid or expired reset token'), { status: 400 });
        }

        try {
            const adminToken = await this.getKeycloakAdminToken();
            await axios.put(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}/reset-password`,
                { type: 'password', value: newPassword, temporary: false },
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
            await User.update({ tempResetToken: null }, { where: { userID } });
            logger.info(`Password reset successful for ${userID}`);
        } catch (error) {
            logger.error(`Password reset error for ${userID}: ${error.message}`);
            throw Object.assign(new Error(ERROR_MESSAGES.PASSWORD_UPDATE_FAILED), { status: 500 });
        }

        return { message: 'Password reset successfully' };
    }

    static async logout(refreshToken) {
        if (refreshToken) {
            const keycloakBaseUrl = `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}`;
            try {
                await axios.post(
                    `${keycloakBaseUrl}/protocol/openid-connect/logout`,
                    new URLSearchParams({
                        client_id: process.env.KEYCLOAK_CLIENT_ID,
                        client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
                        refresh_token: refreshToken,
                    }),
                    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
                );
                logger.info('Keycloak session invalidated');
            } catch (keycloakError) {
                logger.warn('Failed to invalidate Keycloak session', {
                    error: keycloakError.message,
                });
                // Continue with logout even if Keycloak session invalidation fails
            }
        } else {
            logger.warn('No refreshToken found for Keycloak logout');
        }

        const keycloakLogoutUrl = `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}/protocol/openid-connect/logout?client_id=${process.env.KEYCLOAK_CLIENT_ID}&post_logout_redirect_uri=${encodeURIComponent(process.env.FRONTEND_LOGIN_URL)}`;

        return {
            message: 'Logged out successfully',
            keycloakLogoutUrl,
            cookiesToClear: ['accessToken', 'refreshToken', 'userData'],
        };
    }
}

module.exports = AuthService;