const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { sendSMS } = require('../config/sms');
const { transporter } = require('../config/smtp');
const { User, Role, OTP, Permission } = require('../models');
const otpService = require('./otpService');

const JWT_SECRET = process.env.JWT_SECRET;

class AuthService {

    // Login with email/password
    static async login(identifier, password) { 
        try {
            const user = await User.findOne({
                where: {
                    [Op.or]: [ 
                        { email: identifier },
                        { phone: identifier }
                    ]
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

            const roles = user.Roles.map(role => ({
                name: role.name,
                permissions: role.Permissions.map(p => p.name),
            }));

            const token = jwt.sign(
                { userID: user.userID, email: user.email, phone: user.phone, roles },  // Added phone to token
                process.env.JWT_SECRET || 'secret-key',
                { expiresIn: '12h' }
            );

            return { 
                token, 
                user: { 
                    userID: user.userID, 
                    email: user.email, 
                    phone: user.phone,  // Added phone to response
                    roles 
                } 
            };
        } catch (error) {
            throw new Error(`Login failed: ${error.message}`);
        }
    }

    // Add a helper method to determine login type
    static isEmail(identifier) {
        // Basic email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(identifier);
    }

    // Verify 2FA OTP and issue JWT
    static async verify2FA(userID, otpCode) {
        const otp = await otpService.validateOTP(userID, otpCode);
        if (!otp) throw new Error('Invalid or expired OTP');
        const user = await User.findByPk(userID);
        const token = jwt.sign(
            { userID: user.userID, email: user.email },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        return { token };
    }

    // Resend 2FA OTP
    static async resend2FA(userID) {
        const user = await User.findByPk(userID);
        if (!user) throw new Error('User not found');

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await OTP.create({ code: otpCode, expiresAt, userID: user.userID });

        await sendSMS(user.phone, `Your TraceFlow 2FA code is ${otpCode}`);

        return { userID: user.userID, message: 'OTP sent to your phone' };
    }


}

module.exports = AuthService;