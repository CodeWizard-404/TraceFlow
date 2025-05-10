const crypto = require('crypto');
const { Op } = require('sequelize');
const { OTP } = require('../models');
const NotificationService = require('./notificationService');
const logger = require('../utils/logger');

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

            // Trigger notification for OTP
            await NotificationService.triggerNotification({
                event: `otp:generated:${type}`,
                data: { code, entityID, type },
                metadata: { expiresAt: expiresAt.toISOString() },
            });

            logger.info('OTP generated', {
                route: 'otp',
                service: 'authentication',
                entityID,
                type,
            });

            return otp;
        } catch (error) {
            logger.error('Failed to generate OTP', {
                route: 'otp',
                service: 'authentication',
                message: error.message,
            });
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
                logger.warn('Invalid or expired OTP', {
                    route: 'otp',
                    service: 'authentication',
                    entityID,
                    type,
                });
                throw new Error('Invalid or expired OTP');
            }

            // Mark OTP as used and delete
            await otp.update({ used: true });
            await otp.destroy();

            logger.info('OTP validated successfully', {
                route: 'otp',
                service: 'authentication',
                entityID,
                type,
            });

            return true;
        } catch (error) {
            logger.error('Failed to validate OTP', {
                route: 'otp',
                service: 'authentication',
                message: error.message,
            });
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
            logger.info(`Cleaned up ${count} expired OTPs`, {
                route: 'otp',
                service: 'authentication',
            });
        } catch (error) {
            logger.error('Expired OTP cleanup error', {
                route: 'otp',
                service: 'authentication',
                message: error.message,
            });
        }
    }
}

module.exports = OTPService;