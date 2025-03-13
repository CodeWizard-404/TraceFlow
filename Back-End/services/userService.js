const { User, Role, OTP, Permission } = require('../models');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');

class userService {
    // createUser(userDetails): Create a new user with roles (US 45)
    static async createUser(adminID, userDetails) {
        const { firstname, lastname, phone, email, password, roleIDs = [] } = userDetails;

        // Validate admin
        const admin = await User.findByPk(adminID);
        if (!admin) throw new Error('Admin not found');

        // Check if email or phone is unique
        const existingUser = await User.findOne({ where: { [Op.or]: [{ email }, { phone }] } });
        if (existingUser) throw new Error('Email or phone already in use');

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            firstname,
            lastname,
            phone,
            email,
            password: hashedPassword,
            wallet: '', // Default empty, updated later if needed
        });

        if (roleIDs.length > 0) {
            await user.setRoles(roleIDs); // Assign roles (and their permissions) to user
        }

        return user;
    }

    // viewUser(userID): View a specific user’s details, including roles and permissions
    static async viewUser(adminID, userID) {
        const admin = await User.findByPk(adminID);
        if (!admin) throw new Error('Admin not found');

        const user = await User.findByPk(userID, {
            include: [{
                model: Role,
                through: { attributes: [] },
                include: [{ model: Permission, attributes: ['permissionID', 'permission', 'description'] }],
            }],
        });
        if (!user) throw new Error('User not found');

        return user;
    }

    // listUsers(): List all users with their roles and permissions (US 48)
    static async listUsers(adminID) {
        const admin = await User.findByPk(adminID);
        if (!admin) throw new Error('Admin not found');

        const users = await User.findAll({
            include: [{
                model: Role,
                through: { attributes: [] },
                include: [{ model: Permission, attributes: ['permissionID', 'permission', 'description'] }],
            }],
        });
        return users;
    }

    // validateOtp(otp): Validate an OTP for a user (used in receipt book workflows)
    static async validateOtp(userID, otpCode) {
        const otp = await OTP.findOne({
            where: {
                userID,
                code: otpCode,
                expiresAt: { [Op.gt]: new Date() },
            },
        });
        if (!otp) throw new Error('Invalid or expired OTP');

        await otp.destroy(); // OTP is single-use
        return true;
    }
};

module.exports = userService;