// services/authService.js
const axios = require('axios');
const { nanoid } = require('nanoid');
const { User, Role, OTP, Permission, TrustedDevice } = require('../models');
const otpService = require('./otpService');
const { transporter } = require('../config/smtp');
const { sendSMS } = require('../config/sms');
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
};


// Keycloak config
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || 'your-client-secret-from-keycloak';

class AuthService {
    // Get Keycloak admin token
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
            console.error(`Admin token error:`, error.message);
            throw new Error(ERROR_MESSAGES.KEYCLOAK_ADMIN_TOKEN_FAILED);
        }
    }

    // Sync user with Keycloak
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
            console.error(`Sync error:`, error.message);
            throw error.message === ERROR_MESSAGES.KEYCLOAK_MISMATCH
                ? error
                : new Error(ERROR_MESSAGES.DATABASE_ERROR);
        }
    }

    // User login
    static async login(identifier, password, deviceIdentifier, otpMethod = 'phone') {
        console.log(`Attempting login for ${identifier} using ${otpMethod} OTP with passsword ${password} from device ${deviceIdentifier}`);
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
                })
            );
        } catch (error) {
            console.error(`Login failed for ${identifier}:`, error.response?.data || error.message);
            throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
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
            console.error(`Keycloak fetch error:`, error.message);
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

        const trustedDevice = await TrustedDevice.findOne({
            where: { userID: user.userID, deviceIdentifier, status: 'active' },
        });
        if (trustedDevice) {
            await trustedDevice.update({ lastUsed: new Date() });
            return this.generateLoginResponse(
                userWithDetails,
                loginResponse.data.access_token,
                loginResponse.data.refresh_token,
                loginResponse.data.expires_in
            );
        }

        try {
            if (otpMethod === 'phone' && user.phone !== 'N/A') {
                const otp = await otpService.generateOTP(user.userID, 'user');
                await sendSMS(user.phone, `Your TraceFlow OTP is ${otp.code}`);
            } else if (otpMethod === 'email' && user.email) {
                const otp = await otpService.generateOTP(user.userID, 'user');
                await transporter.sendMail({
                    from: process.env.SMTP_USER,
                    to: user.email,
                    subject: 'TraceFlow OTP',
                    text: `Your OTP is ${otp.code}. It expires in 10 minutes.`,
                });
            } else {
                throw new Error(ERROR_MESSAGES.NO_OTP_METHOD);
            }
        } catch (error) {
            console.error(`OTP error:`, error.message);
            throw error.message === ERROR_MESSAGES.NO_OTP_METHOD
                ? error
                : new Error(ERROR_MESSAGES.OTP_SEND_FAILED);
        }

        return {
            requires2FA: true,
            userID: user.userID,
            deviceIdentifier,
            tempToken: loginResponse.data.access_token,
            refreshToken: loginResponse.data.refresh_token,
            expiresIn: loginResponse.data.expires_in,
            message: `OTP sent to your ${otpMethod}`,
        };
    }

    // Verify 2FA
    static async verify2FA(userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken) {
        console.log(`Attempting 2FA verification for user ${userID, otpCode, deviceIdentifier, trustDevice}`);
        const user = await User.findByPk(userID);
        if (!user) throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);

        try {
            await otpService.validateOTP(user.userID, otpCode, 'user');
        } catch (error) {
            console.error(`OTP validation error:`, error.message);
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

        try {
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
                        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                    });
                }
            }
        } catch (error) {
            console.error(`Device trust error:`, error.message);
            throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
        }

        return this.generateLoginResponse(userWithDetails, tempToken, refreshToken, 900);
    }

    // Refresh token
    static async refreshToken(refreshToken) {
        console.log(`Attempting to refresh token for refresh token`);
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
            return {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiresIn: response.data.expires_in,
            };
        } catch (error) {
            console.error('Token refresh failed:', error.response?.data || error.message);
            throw new Error(ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
        }
    }

    // Resend 2FA OTP
    static async resend2FA(userID, otpMethod = 'phone') {
        console.log(`Attempting to resend 2FA OTP for user ${userID} via ${otpMethod}`);
        const user = await User.findByPk(userID);
        if (!user) throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);

        try {
            if (otpMethod === 'phone' && user.phone !== 'N/A') {
                const otp = await otpService.generateOTP(userID, 'user');
                await sendSMS(user.phone, `Your TraceFlow OTP is ${otp.code}`);
                return { userID, message: 'OTP resent to your phone' };
            } else if (otpMethod === 'email' && user.email) {
                const otp = await otpService.generateOTP(userID, 'user');
                await transporter.sendMail({
                    from: process.env.SMTP_USER,
                    to: user.email,
                    subject: 'TraceFlow OTP',
                    text: `Your OTP is ${otp.code}. It expires in 10 minutes.`,
                });
                return { userID, message: 'OTP resent to your email' };
            } else {
                throw new Error(ERROR_MESSAGES.NO_OTP_METHOD);
            }
        } catch (error) {
            console.error(`Resend OTP error:`, error.message);
            throw error.message === ERROR_MESSAGES.NO_OTP_METHOD
                ? error
                : new Error(ERROR_MESSAGES.OTP_SEND_FAILED);
        }
    }

    // Initiate password reset
    static async initiatePasswordReset(identifier) {
        console.log(`Attempting to initiate password reset for identifier: ${identifier}`);
        let keycloakId;
        try {
            const adminToken = await this.getKeycloakAdminToken();
            const userResponse = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=${identifier}&exact=true`,
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
            if (!userResponse.data.length) throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            keycloakId = userResponse.data[0].id;
        } catch (error) {
            console.error(`Keycloak user error:`, error.message);
            throw error.message === ERROR_MESSAGES.USER_NOT_FOUND
                ? error
                : new Error(ERROR_MESSAGES.KEYCLOAK_UNAVAILABLE);
        }

        try {
            const adminToken = await this.getKeycloakAdminToken();
            await axios.put(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${keycloakId}/execute-actions-email`,
                ['UPDATE_PASSWORD'],
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
        } catch (error) {
            console.error(`Reset email error:`, error.message);
            throw new Error(ERROR_MESSAGES.PASSWORD_RESET_FAILED);
        }

        const user = await User.findOne({ where: { keycloakId } });
        return { userID: user?.userID || keycloakId, message: 'Password reset instructions sent' };
    }

    // Reset password
    static async resetPassword(userID, newPassword) {
        console.log(`Attempting to reset password for user ${userID}`);
        const user = await User.findByPk(userID);
        if (!user) throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);

        try {
            const adminToken = await this.getKeycloakAdminToken();
            await axios.put(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}`,
                { type: 'password', value: newPassword, temporary: false },
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
        } catch (error) {
            console.error(`Password update error:`, error.message);
            throw new Error(ERROR_MESSAGES.PASSWORD_UPDATE_FAILED);
        }

        return { message: 'Password reset successfully' };
    }

    // Verify password reset OTP (placeholder since not provided)
    static async verifyPasswordResetOTP(userID, otpCode) {
        console.log(`Attempting to verify password reset OTP for user ${userID}`);
        const user = await User.findByPk(userID);
        if (!user) throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);

        try {
            await otpService.validateOTP(user.userID, otpCode, 'user');
        } catch (error) {
            console.error(`Reset OTP error:`, error.message);
            throw new Error(ERROR_MESSAGES.INVALID_OTP);
        }

        return { userID, message: 'OTP verified' }; // Placeholder response
    }

    // Generate login response
    static generateLoginResponse(user, token, refreshToken, expiresIn) {
        console.log(`Generating login response for user ${user.userID}`);
        const roles = user.Roles.map((role) => ({
            name: role.name,
            permissions: role.Permissions.map((p) => p.name),
        }));
        return {
            token,
            refreshToken,
            expiresIn,
            user: {
                userID: user.userID,
                email: user.email,
                phone: user.phone,
                roles,
            },
        };
    }
}

module.exports = AuthService;