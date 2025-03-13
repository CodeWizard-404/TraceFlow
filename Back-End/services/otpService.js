const crypto = require('crypto');
const { Op } = require('sequelize');
const { OTP } = require('../models');

class OTPService {
    // Generate a new OTP for a user
    static async generateOTP(userID) {
        const code = crypto.randomInt(100000, 999999).toString(); // 6-digit OTP
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // Expires in 10 minutes

        const otp = await OTP.create({
            code,
            expiresAt,
            userID,
        });
        return otp;
    }

    // Send an OTP via SMS

    // Validate an OTP
    static async validateOTP(userID, code) {
        const otp = await OTP.findOne({
            where: {
                userID,
                code,
                expiresAt: { [Op.gt]: new Date() }, // Check if not expired
            },
        });

        if (!otp) {
            throw new Error('Invalid or expired OTP');
        }

        // Optionally delete the OTP after validation
        await otp.destroy();
        return true;
    }

    // Delete expired OTPs (cleanup)
    static async cleanupExpiredOTPs() {
        await OTP.destroy({
            where: {
                expiresAt: { [Op.lt]: new Date() },
            },
        });
    }
}

module.exports = OTPService;