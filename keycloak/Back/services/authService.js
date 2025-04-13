const axios = require('axios');
const { nanoid } = require('nanoid');
const { User, Role, OTP, Permission, TrustedDevice } = require('../models');
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
};

const verificationCache = new Map();
const CACHE_TTL = 5000;

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || 'your-client-secret-from-keycloak';

class AuthService {
    static async getKeycloakAdminToken() {
        try {
            const response = await axios.post(
                `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: 'password',
                    client_id: 'admin-cli',
                    username: process.env.KEYCLOAK_ADMIN_USER || 'admin',
                    password: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
                })
            );
            return response.data.access_token;
        } catch (error) {
            logger.error(`Keycloak admin token error: ${error.message}`);
            throw new Error(ERROR_MESSAGES.KEYCLOAK_ADMIN_TOKEN_FAILED);
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
                    wallet: `wallet_${nanoid()}`,
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
                : new Error(ERROR_MESSAGES.DATABASE_ERROR);
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
                throw new Error(ERROR_MESSAGES.INVALID_KEYCLOAK_RESPONSE);
            }
        } catch (error) {
            logger.error(`Keycloak login error for ${identifier}: ${error.message}`);
            throw new Error(
                error.message === ERROR_MESSAGES.INVALID_KEYCLOAK_RESPONSE
                    ? error.message
                    : ERROR_MESSAGES.INVALID_CREDENTIALS
            );
        }

        let keycloakUserResponse;
        try {
            const adminToken = await this.getKeycloakAdminToken();
            keycloakUserResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=${identifier}&exact=true`,
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
            if (!keycloakUserResponse.data.length) throw new Error(ERROR_MESSAGES.KEYCLOAK_USER_NOT_FOUND);
        } catch (error) {
            logger.error(`Keycloak user fetch error for ${identifier}: ${error.message}`);
            throw error.message === ERROR_MESSAGES.KEYCLOAK_USER_NOT_FOUND
                ? error
                : new Error(ERROR_MESSAGES.KEYCLOAK_UNAVAILABLE);
        }

        const keycloakId = keycloakUserResponse.data[0].id;
        const user = await this.syncKeycloakUser(identifier, keycloakId);

        const userWithDetails = await User.findOne({
            where: { keycloakId },
            include: [
                {
                    model: Role,
                    through: { attributes: [] },
                    include: [{ model: Permission, through: { attributes: [] }, attributes: ['name', 'class'] }],
                },
            ],
        });

        if (!userWithDetails) {
            logger.error(`User details fetch failed for ${identifier}`);
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
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
        const phoneRegex = /^\+?\d{8,12}$/;
        const hasValidEmail = user.email && emailRegex.test(user.email);
        const hasValidPhone = user.phone && user.phone !== 'N/A' && phoneRegex.test(user.phone);

        if (!hasValidEmail && !hasValidPhone) {
            logger.error(`No valid OTP method for ${user.userID}`);
            throw new Error(ERROR_MESSAGES.NO_OTP_METHOD);
        }

        try {
            let otp;
            let selectedMethod = otpMethod;

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
                        throw new Error(ERROR_MESSAGES.OTP_SEND_FAILED);
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
                            otp = await otpService.generateOTP(user.userID, 'user');
                            await transporter.sendMail({
                                from: process.env.SMTP_USER,
                                to: user.email,
                                subject: 'TraceFlow 2FA OTP',
                                text: `Your OTP is ${otp.code}. It expires in 10 minutes.`,
                            });
                        } else {
                            throw new Error(ERROR_MESSAGES.OTP_SEND_FAILED);
                        }
                    } else {
                        selectedMethod = smsResult.fallback ? 'email' : 'phone';
                    }
                } catch (error) {
                    logger.error(`SMS OTP send failed for ${user.userID}: ${error.message}`);
                    throw new Error(ERROR_MESSAGES.OTP_SEND_FAILED);
                }
            }

            if (!otp) {
                logger.error(`OTP delivery failed for ${user.userID}`);
                throw new Error(ERROR_MESSAGES.OTP_SEND_FAILED);
            }

            return {
                requires2FA: true,
                userID: user.userID,
                deviceIdentifier,
                tempToken: loginResponse.data.access_token,
                refreshToken: loginResponse.data.refresh_token,
                expiresIn: loginResponse.data.expires_in,
                message: `OTP sent to your ${selectedMethod}`,
            };
        } catch (error) {
            logger.error(`OTP error for ${identifier}: ${error.message}`);
            throw error.message === ERROR_MESSAGES.NO_OTP_METHOD
                ? error
                : new Error(ERROR_MESSAGES.OTP_SEND_FAILED);
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
            throw new Error(`${ERROR_MESSAGES.MISSING_FIELDS} Missing: ${missingFields.join(', ')}`);
        }

        const cacheKey = `${userID}:${otpCode}:${deviceIdentifier}`;
        const cachedResult = verificationCache.get(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }

        const user = await User.findByPk(userID);
        if (!user) {
            logger.error(`2FA verification failed: User ${userID} not found`);
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        try {
            await otpService.validateOTP(user.userID, otpCode, 'user');
        } catch (error) {
            logger.error(`2FA OTP validation failed for ${userID}: ${error.message}`);
            throw new Error(ERROR_MESSAGES.INVALID_OTP);
        }

        const userWithDetails = await User.findOne({
            where: { userID },
            include: [
                {
                    model: Role,
                    through: { attributes: [] },
                    include: [{ model: Permission, through: { attributes: [] }, attributes: ['name', 'class'] }],
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
            const response = await axios.post(
                `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    refresh_token: refreshToken,
                })
            );

            if (
                !response.data ||
                !response.data.access_token ||
                !response.data.refresh_token ||
                !response.data.expires_in
            ) {
                throw new Error(ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
            }

            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Lax',
                path: '/',
            };

            res.cookie('accessToken', response.data.access_token, {
                ...cookieOptions,
                maxAge: response.data.expires_in * 1000,
            });
            res.cookie('refreshToken', response.data.refresh_token, {
                ...cookieOptions,
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            return {
                user: { message: 'Token refreshed' },
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
            };
        } catch (error) {
            logger.error(`Token refresh error: ${error.message}`);
            throw new Error(ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
        }
    }

    static generateLoginResponse(user, token, refreshToken, expiresIn, res) {
        if (!user || !token || !refreshToken || !expiresIn) {
            logger.error(`Invalid login response data for user ${user?.userID || 'unknown'}`);
            throw new Error(ERROR_MESSAGES.INVALID_KEYCLOAK_RESPONSE);
        }

        const roles = user.Roles?.map((role) => ({
            roleID: role.roleID,
            name: role.name,
            description: role.description || undefined,
            permissions: role.Permissions ? role.Permissions.map((p) => ({
                permissionID: p.permissionID,
                name: p.name,
                class: p.class,
                description: p.description || undefined,
            })) : [],
        })) || [];

        const cookieOptions = {
            httpOnly: true,
            secure: false,
            maxAge: expiresIn * 1000,
            sameSite: 'Lax',
            path: '/',
        };

        res.cookie('accessToken', token, cookieOptions);
        res.cookie('refreshToken', refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000,
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
        };
    }

    static async resend2FA(userID, otpMethod = 'email') {
        const user = await User.findByPk(userID);
        if (!user) {
            logger.error(`Resend 2FA failed: User ${userID} not found`);
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^\+?\d{8,12}$/;
        const hasValidEmail = user.email && emailRegex.test(user.email);
        const hasValidPhone = user.phone && user.phone !== 'N/A' && phoneRegex.test(user.phone);

        if (!hasValidEmail && !hasValidPhone) {
            logger.error(`No valid OTP method for ${userID}`);
            throw new Error(ERROR_MESSAGES.NO_OTP_METHOD);
        }

        try {
            let otp;
            let selectedMethod = otpMethod;

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
                        otp = await otpService.generateOTP(userID, 'user');
                        await transporter.sendMail({
                            from: process.env.SMTP_USER,
                            to: user.email,
                            subject: 'TraceFlow OTP',
                            text: `Your OTP is ${otp.code}. It expires in 10 minutes.`,
                        });
                    } else {
                        throw new Error(ERROR_MESSAGES.OTP_SEND_FAILED);
                    }
                } else {
                    selectedMethod = smsResult.fallback ? 'email' : 'phone';
                }
            } else {
                logger.error(`Invalid OTP method for ${userID}: ${otpMethod}`);
                throw new Error(ERROR_MESSAGES.NO_OTP_METHOD);
            }

            return { userID, message: `OTP resent to your ${selectedMethod}` };
        } catch (error) {
            logger.error(`Resend OTP error for ${userID}: ${error.message}`);
            throw error.message === ERROR_MESSAGES.NO_OTP_METHOD
                ? error
                : new Error(ERROR_MESSAGES.OTP_SEND_FAILED);
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
            if (!userResponse.data.length) throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            keycloakId = userResponse.data[0].id;
            user = await this.syncKeycloakUser(identifier, keycloakId);
        } catch (error) {
            logger.error(`Password reset init error for ${identifier}: ${error.message}`);
            throw error.message === ERROR_MESSAGES.USER_NOT_FOUND
                ? error
                : new Error(ERROR_MESSAGES.KEYCLOAK_UNAVAILABLE);
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^\+?\d{8,12}$/;
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
                    throw new Error(ERROR_MESSAGES.PASSWORD_RESET_FAILED);
                }
                selectedMethod = smsResult.fallback ? 'email' : 'phone';
            } else {
                logger.error(`No valid OTP method for ${user.userID}`);
                throw new Error(ERROR_MESSAGES.NO_OTP_METHOD);
            }

            return { userID: user.userID, message: `OTP sent to your ${selectedMethod}` };
        } catch (error) {
            logger.error(`Password reset OTP error for ${user.userID}: ${error.message}`);
            throw error.message === ERROR_MESSAGES.NO_OTP_METHOD
                ? error
                : new Error(ERROR_MESSAGES.PASSWORD_RESET_FAILED);
        }
    }

    static async verifyPasswordResetOTP(userID, otpCode) {
        const user = await User.findByPk(userID);
        if (!user) {
            logger.error(`Password reset OTP verification failed: User ${userID} not found`);
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        try {
            await otpService.validateOTP(user.userID, otpCode, 'user');
        } catch (error) {
            logger.error(`Password reset OTP validation failed for ${userID}: ${error.message}`);
            throw new Error(ERROR_MESSAGES.INVALID_OTP);
        }

        const tempToken = nanoid();
        await User.update({ tempResetToken: tempToken }, { where: { userID } });

        return { userID, tempToken, message: 'OTP verified. Proceed to reset password.' };
    }

    static async resetPassword(userID, newPassword, tempToken) {
        const user = await User.findByPk(userID);
        if (!user) {
            logger.error(`Password reset failed: User ${userID} not found`);
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        if (user.tempResetToken !== tempToken) {
            logger.error(`Password reset failed for ${userID}: Invalid reset token`);
            throw new Error('Invalid or expired reset token');
        }

        try {
            const adminToken = await this.getKeycloakAdminToken();
            await axios.put(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}/reset-password`,
                { type: 'password', value: newPassword, temporary: false },
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
            await User.update({ tempResetToken: null }, { where: { userID } });
        } catch (error) {
            logger.error(`Password reset error for ${userID}: ${error.message}`);
            throw new Error(ERROR_MESSAGES.PASSWORD_UPDATE_FAILED);
        }

        return { message: 'Password reset successfully' };
    }
}

module.exports = AuthService;