// AuthService.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { sendSMS } = require('../config/sms');
const { transporter } = require('../config/smtp');
const { User, Role, OTP, Permission, TrustedDevice } = require('../models');
const otpService = require('./otpService');

const JWT_SECRET = process.env.JWT_SECRET;

class AuthService {
    static async login(identifier, password, deviceIdentifier) {
        const user = await User.findOne({
            where: {
                [Op.or]: [{ email: identifier }, { phone: identifier }],
            },
            include: [{
                model: Role,
                through: { attributes: [] },
                include: [{
                    model: Permission,
                    through: { attributes: [] },
                    attributes: ['name', 'class'],
                }],
            }],
        });

        if (!user) throw new Error('Invalid credentials');

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) throw new Error('Invalid credentials');

        const trustedDevice = await TrustedDevice.findOne({
            where: { userID: user.userID, deviceIdentifier, status: 'active' },
        });

        if (trustedDevice) {
            await trustedDevice.update({ lastUsed: new Date() });
            return this.generateLoginResponse(user, deviceIdentifier);
        }

        const otpCode = await otpService.generateOTP(user.userID);
        await sendSMS(user.phone, `Your TraceFlow 2FA code is ${otpCode.code}`);

        return {
            requires2FA: true,
            userID: user.userID,
            deviceIdentifier,
            message: 'OTP sent to your phone',
        };
    }

    static async verify2FA(userID, otpCode, deviceIdentifier, trustDevice) {
        const isValid = await otpService.validateOTP(userID, otpCode);
        if (!isValid) throw new Error('Invalid or expired OTP');

        const user = await User.findByPk(userID, {
            include: [{
                model: Role,
                through: { attributes: [] },
                include: [{
                    model: Permission,
                    through: { attributes: [] },
                    attributes: ['name', 'class'],
                }],
            }],
        });

        if (!user) throw new Error('User not found');

        if (trustDevice) {
            const existingDevice = await TrustedDevice.findOne({
                where: { userID: user.userID, deviceIdentifier },
            });

            if (existingDevice) {
                await existingDevice.update({
                    status: 'active',
                    lastUsed: new Date(),
                });
            } else {
                await TrustedDevice.create({
                    userID: user.userID,
                    deviceIdentifier,
                    status: 'active',
                    lastUsed: new Date(),
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                });
            }
        }

        return this.generateLoginResponse(user, deviceIdentifier);
    }

    static async resend2FA(userID) {
        const user = await User.findByPk(userID);
        if (!user) throw new Error('User not found');

        await OTP.destroy({ where: { userID } });
        const otpCode = await otpService.generateOTP(userID);
        await sendSMS(user.phone, `Your TraceFlow 2FA code is ${otpCode.code}`);

        return { userID, message: 'New OTP sent to your phone' };
    }

    static async initiatePasswordReset(identifier) {
        const user = await User.findOne({
            where: {
                [Op.or]: [{ email: identifier }, { phone: identifier }],
            },
        });

        if (!user) throw new Error('User not found');

        await OTP.destroy({ where: { userID: user.userID } });
        const otpCode = await otpService.generateOTP(user.userID);

        if (this.isEmail(identifier)) {
            await transporter.sendMail({
                from: process.env.SMTP_USER,
                to: user.email,
                subject: 'TraceFlow Password Reset',
                text: `Your password reset code is ${otpCode.code}. It expires in 10 minutes.`,
            });
            return { userID: user.userID, message: 'OTP sent to your email' };
        } else {
            await sendSMS(user.phone, `Your TraceFlow password reset code is ${otpCode.code}`);
            return { userID: user.userID, message: 'OTP sent to your phone' };
        }
    }

    static async verifyPasswordResetOTP(userID, otpCode) {
        const isValid = await otpService.validateOTP(userID, otpCode);
        if (!isValid) throw new Error('Invalid or expired OTP');

        return { userID, message: 'OTP verified successfully' };
    }

    static async resetPassword(userID, newPassword) {
        const user = await User.findByPk(userID);
        if (!user) throw new Error('User not found');

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await user.update({ password: hashedPassword });

        return { message: 'Password reset successfully' };
    }

    static generateLoginResponse(user, deviceIdentifier) {
        const roles = user.Roles.map(role => ({
            name: role.name,
            permissions: role.Permissions.map(p => p.name),
        }));

        // Use deviceIdentifier as the token itself, signed with JWT_SECRET
        const token = jwt.sign(
            { userID: user.userID, deviceIdentifier }, // Only userID and deviceIdentifier
            JWT_SECRET,
            { expiresIn: '12h' } // Keep expiration as before
        );

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

    static isEmail(identifier) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    }
}

module.exports = AuthService;