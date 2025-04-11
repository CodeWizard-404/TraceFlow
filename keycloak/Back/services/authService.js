const axios = require('axios');
const { nanoid } = require('nanoid');
const { User, Role, OTP, Permission, TrustedDevice } = require('../models');
const otpService = require('./otpService');
const { transporter } = require('../config/smtp');
const { sendSMS } = require('../config/sms');
require('dotenv').config();

// Keycloak configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || 'your-client-secret-from-keycloak';

class AuthService {
    static async getKeycloakAdminToken() {
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
    }

    static async syncKeycloakUser(identifier, keycloakId) {
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
            throw new Error(`Keycloak ID mismatch: DB has ${user.keycloakId}, Keycloak sent ${keycloakId}`);
        }
        return user;
    }

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
            throw new Error('Invalid credentials');
        }

        const adminToken = await this.getKeycloakAdminToken();
        const keycloakUserResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=${identifier}&exact=true`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        if (!keycloakUserResponse.data.length) throw new Error('User not found in Keycloak');
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
            throw new Error(`No ${otpMethod} configured for user`);
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

    static async verify2FA(userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken) {
        console.log(`Attempting 2FA verification for user ${userID, otpCode, deviceIdentifier, trustDevice}`);
        const user = await User.findByPk(userID);
        if (!user) throw new Error('User not found');

        await otpService.validateOTP(user.userID, otpCode, 'user');

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
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                });
            }
        }

        return this.generateLoginResponse(userWithDetails, tempToken, refreshToken, 900); // 15 minutes in seconds
    }

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
            throw new Error('Invalid or expired refresh token');
        }
    }

    // Resend 2FA OTP
    static async resend2FA(userID, otpMethod = 'phone') {
        console.log(`Attempting to resend 2FA OTP for user ${userID} via ${otpMethod}`);
        const user = await User.findByPk(userID);
        if (!user) throw new Error('User not found');

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
            throw new Error(`No ${otpMethod} configured for user`);
        }
    }

    // Initiate password reset
    static async initiatePasswordReset(identifier) {
        console.log(`Attempting to initiate password reset for identifier: ${identifier}`);
        const adminToken = await this.getKeycloakAdminToken();

        // Step 1: Find the user in Keycloak
        const userResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=${identifier}&exact=true`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        if (!userResponse.data.length) throw new Error('User not found');
        const keycloakId = userResponse.data[0].id;

        // Step 2: Send reset password email via Keycloak
        await axios.put(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${keycloakId}/execute-actions-email`,
            ['UPDATE_PASSWORD'],
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        // Step 3: Return the local userID for consistency
        const user = await User.findOne({ where: { keycloakId } });
        return { userID: user?.userID || keycloakId, message: 'Password reset instructions sent' };
    }

    // Reset password directly
    static async resetPassword(userID, newPassword) {
        console.log(`Attempting to reset password for user ${userID}`);
        const user = await User.findByPk(userID);
        if (!user) throw new Error('User not found');

        const adminToken = await this.getKeycloakAdminToken();

        // Update password in Keycloak using keycloakId
        await axios.put(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}`,
            { type: 'password', value: newPassword, temporary: false },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        return { message: 'Password reset successfully' };
    }

    // Generate a standard login response
    static generateLoginResponse(user, token, refreshToken, expiresIn) {
        console.log(`Generating login response for user ${user.userID}`);
        const roles = user.Roles.map(role => ({
            name: role.name,
            permissions: role.Permissions.map(p => p.name),
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