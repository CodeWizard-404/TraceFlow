const crypto = require('crypto');
const { Op } = require('sequelize');
const { OTP, User } = require('../models');

class OTPService {
    // Generate a new OTP for a user
    static async generateOTP(entityID, type = 'user') {
        try {
            const code = crypto.randomInt(100000, 999999).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
            const otpData = { code, expiresAt, used: false };
            otpData[type === 'user' ? 'userID' : 'agentID'] = entityID;

            // Store in local database
            const otp = await OTP.create(otpData);

            return otp;
        } catch (error) {
            console.error('OTP generation error:', error.message);
            throw new Error('Failed to generate OTP');
        }
    }

    // Validate OTP
    static async validateOTP(entityID, code, type = 'user') {
        try {
            const where = {
                code,
                expiresAt: { [Op.gt]: new Date() },
                used: false,
            };
            where[type === 'user' ? 'userID' : 'agentID'] = entityID;

            // Check local database
            const otp = await OTP.findOne({ where });
            if (!otp) {
                console.error('OTP not found or invalid:', { entityID, code });
                throw new Error('Invalid or expired OTP');
            }

            // Mark OTP as used and delete
            await otp.update({ used: true });
            await otp.destroy();

            return true;
        } catch (error) {
            console.error('OTP validation error:', error.message);
            throw new Error(error.message || 'Failed to validate OTP');
        }
    }

    // Delete expired OTPs (cleanup)
    static async cleanupExpiredOTPs() {
        try {
            const count = await OTP.destroy({
                where: {
                    expiresAt: { [Op.lt]: new Date() },
                },
            });
            console.log(`Cleaned up ${count} expired OTPs`);
        } catch (error) {
            console.error('Expired OTP cleanup error:', error.message);
        }
    }
}

module.exports = OTPService;