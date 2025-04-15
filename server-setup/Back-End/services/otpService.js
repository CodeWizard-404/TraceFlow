const crypto = require('crypto');
const { Op } = require('sequelize');
const { OTP } = require('../models');

class OTPService {
    // Generate a new OTP for a user
    static async generateOTP(entityID, type = 'user') {
        const code = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const otpData = { code, expiresAt };
        otpData[type === 'user' ? 'userID' : 'agentID'] = entityID;
        return await OTP.create(otpData);
    }

    static async validateOTP(entityID, code, type = 'user') {
        const where = { code, expiresAt: { [Op.gt]: new Date() } };
        where[type === 'user' ? 'userID' : 'agentID'] = entityID;
        const otp = await OTP.findOne({ where });
        if (!otp) throw new Error('Invalid or expired OTP');
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