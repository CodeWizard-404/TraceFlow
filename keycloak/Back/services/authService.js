const axios = require("axios");
const { nanoid } = require("nanoid");
const { User, Role, OTP, Permission, TrustedDevice } = require("../models");
const otpService = require("./otpService");
const { transporter } = require("../config/smtp");
const { sendSMS } = require("../config/sms");

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || "http://localhost:8080";
const REALM = process.env.REALM || "TraceFlow";
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || "traceflow-backend";
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || "your-client-secret-from-keycloak";

class AuthService {
    static async getKeycloakAdminToken() {
        const response = await axios.post(
            `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: "password",
                client_id: "admin-cli",
                username: process.env.KEYCLOAK_ADMIN_USER || "admin",
                password: process.env.KEYCLOAK_ADMIN_PASSWORD || "admin",
            })
        );
        return response.data.access_token;
    }

    static async syncKeycloakUser(identifier, keycloakId) {
        let user = await User.findOne({ where: { email: identifier } });
        if (!user) {
            user = await User.create({
                email: identifier,
                firstname: "Unknown",
                lastname: "User",
                phone: "N/A", // Update as needed
                wallet: `wallet_${nanoid()}`,
                password: "keycloak_managed",
                keycloakId,
            });
        } else if (!user.keycloakId) {
            await user.update({ keycloakId });
        } else if (user.keycloakId !== keycloakId) {
            throw new Error("Keycloak ID mismatch for existing user");
        }
        return user;
    }

    static async login(identifier, password, deviceIdentifier, otpMethod = "phone") {
        let access_token;
        try {
            const response = await axios.post(
                `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: "password",
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    username: identifier,
                    password,
                })
            );
            access_token = response.data.access_token;
        } catch (error) {
            console.error(`${new Date().toISOString()} - Keycloak login failed:`, error.response?.data || error.message);
            throw new Error(error.response?.data?.error || "Invalid credentials");
        }

        const adminToken = await this.getKeycloakAdminToken();
        const keycloakUserResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=${identifier}&exact=true`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        if (!keycloakUserResponse.data.length) throw new Error("User not found in Keycloak");
        const keycloakId = keycloakUserResponse.data[0].id;

        const user = await this.syncKeycloakUser(identifier, keycloakId);
        const userWithDetails = await User.findOne({
            where: { userID: user.userID },
            include: [
                {
                    model: Role,
                    through: { attributes: [] },
                    include: [{ model: Permission, through: { attributes: [] }, attributes: ["name", "class"] }],
                },
            ],
        });

        const trustedDevice = await TrustedDevice.findOne({
            where: { userID: user.userID, deviceIdentifier, status: "active" },
        });
        if (trustedDevice) {
            await trustedDevice.update({ lastUsed: new Date() });
            return this.generateLoginResponse(userWithDetails, access_token);
        }

        if (otpMethod === "phone" && user.phone !== "N/A") {
            const otp = await otpService.generateOTP(user.userID, "user");
            await sendSMS(user.phone, `Your TraceFlow OTP is ${otp.code}`);
        } else if (otpMethod === "email" && user.email) {
            const otp = await otpService.generateOTP(user.userID, "user");
            await transporter.sendMail({
                from: process.env.SMTP_USER,
                to: user.email,
                subject: "TraceFlow OTP",
                text: `Your OTP is ${otp.code}. It expires in 10 minutes.`,
            });
        } else {
            throw new Error(`No ${otpMethod} configured for user`);
        }

        return {
            requires2FA: true,
            userID: user.keycloakId,
            deviceIdentifier,
            tempToken: access_token, // Return the initial token
            message: `OTP sent to your ${otpMethod}`,
        };
    }

    static async verify2FA(userID, otpCode, deviceIdentifier, trustDevice, tempToken) {
        const user = await User.findOne({ where: { keycloakId: userID } });
        if (!user) throw new Error("User not found");

        await otpService.validateOTP(user.userID, otpCode, "user");

        const userWithDetails = await User.findOne({
            where: { userID: user.userID },
            include: [
                {
                    model: Role,
                    through: { attributes: [] },
                    include: [{ model: Permission, through: { attributes: [] }, attributes: ["name", "class"] }],
                },
            ],
        });

        if (trustDevice) {
            const existingDevice = await TrustedDevice.findOne({
                where: { userID: user.userID, deviceIdentifier },
            });
            if (existingDevice) {
                await existingDevice.update({ status: "active", lastUsed: new Date() });
            } else {
                await TrustedDevice.create({
                    userID: user.userID,
                    deviceIdentifier,
                    status: "active",
                    lastUsed: new Date(),
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                });
            }
        }

        return this.generateLoginResponse(userWithDetails, tempToken);
    }

    static async resend2FA(userID, otpMethod = "phone") {
        const adminToken = await this.getKeycloakAdminToken();
        const userResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        const user = userResponse.data;

        if (otpMethod === "email" && user.email) {
            await axios.put(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}/execute-actions-email`,
                ["VERIFY_EMAIL"],
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
            return { userID, message: "OTP resent to your email" };
        } else if (otpMethod === "phone" && user.attributes?.phone) {
            const otp = await otpService.generateOTP(userID, "user");
            await sendSMS(user.attributes.phone, `Your TraceFlow OTP is ${otp.code}`);
            return { userID, message: "OTP resent to your phone" };
        } else {
            throw new Error(`No ${otpMethod} configured for user`);
        }
    }

    static async initiatePasswordReset(identifier) {
        const adminToken = await this.getKeycloakAdminToken();
        const userResponse = await axios.get(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=${identifier}&exact=true`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        if (!userResponse.data.length) throw new Error("User not found");

        const userID = userResponse.data[0].id;
        await axios.put(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}/reset-password`,
            { type: "password", temporary: true },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        return { userID, message: "Password reset OTP sent" };
    }

    static async verifyPasswordResetOTP(userID, otpCode) {
        await axios.post(
            `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: "password",
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                username: userID,
                password: otpCode,
            })
        );
        return { userID, message: "OTP verified" };
    }

    static async resetPassword(userID, newPassword) {
        const adminToken = await this.getKeycloakAdminToken();
        await axios.put(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}/reset-password`,
            { type: "password", value: newPassword, temporary: false },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        return { message: "Password reset successfully" };
    }

    static generateLoginResponse(user, token) {
        const roles = user.Roles.map((role) => ({
            name: role.name,
            permissions: role.Permissions.map((p) => p.name),
        }));
        return {
            token,
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