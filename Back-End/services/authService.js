const { User, Role, OTP, Permission } = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { transporter } = require('../config/smtp');
//const { sendSMS } = require('../config/sms');
const { Op } = require('sequelize');

const JWT_SECRET = process.env.JWT_SECRET;

class AuthService {
    // Create a new user (User Story 45)
    static async createUser(firstname, lastname, email, password, phone, wallet, roleNames = []) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            firstname,
            lastname,
            email,
            password: hashedPassword,
            phone,
            wallet,
        });

        if (roleNames.length > 0) {
            const roles = await Role.findAll({ where: { name: roleNames } });
            if (roles.length !== roleNames.length) {
                throw new Error('One or more roles not found');
            }
            await user.setRoles(roles);
        }

        // Send welcome email
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: email,
            subject: 'Welcome to TraceFlow',
            text: `Your account has been created. Email: ${email}, Password: ${password}, Phone: ${phone}, Role: ${roleNames.join(', ')}`,
        });

        return user;
    }

    // View all users (User Story 48)
    static async getAllUsers() {
        return await User.findAll({
            include: [
            { model: Role, through: { attributes: [] } },
            ],
            attributes: { exclude: ['password'] },
        });
    }

    // Login with email/password and send 2FA OTP (User Story 38)
    static async login(email, password) {
        const user = await User.findOne({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            throw new Error('Invalid credentials');
        }

        //const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        //const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        //await OTP.create({ code: otpCode, expiresAt, userID: user.userID });

        //await sendSMS(user.phone, `Your TraceFlow 2FA code is ${otpCode}`);

        //return { userID: user.userID, message: 'OTP sent to your phone' };

        const token = jwt.sign(
            { userID: user.userID, email: user.email },
            JWT_SECRET,
            { expiresIn: '12h' }
        );
        return { token };


    }

    // Verify 2FA OTP and issue JWT
    static async verify2FA(userID, otpCode) {
        const otp = await OTP.findOne({
            where: {
                userID,
                code: otpCode,
                expiresAt: { [Op.gt]: new Date() },
            },
        });
        if (!otp) throw new Error('Invalid or expired OTP');

        const user = await User.findByPk(userID);
        const token = jwt.sign(
            { userID: user.userID, email: user.email },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        await otp.destroy();
        return { token };
    }

    // Create a new role (User Story 49)
    static async createRole(name, description) {
        return await Role.create({ name, description });
    }

    // View role details (User Story 52)
    static async getRoleDetails(roleID) {
        const role = await Role.findByPk(roleID, {
            include: [{ model: Permission, through: { attributes: [] } }],
        });
        if (!role) throw new Error('Role not found');
        return role;
    }

    // Assign roles to user (User Story 53)
    static async assignRolesToUser(userID, roleNames) {
        const user = await User.findByPk(userID);
        if (!user) throw new Error('User not found');
        const roles = await Role.findAll({ where: { name: roleNames } });
        await user.setRoles(roles);
        return user;
    }
}

module.exports = AuthService;