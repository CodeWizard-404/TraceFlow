const axios = require('axios');
const { User, Agent } = require('../models');
const { transporter } = require('./smtp');
const logger = require('../utils/logger');
require('dotenv').config();

async function sendSMS(to, message, context = 'general') {
    try {
        const response = await axios.post(`${process.env.SMS_GATEWAY_URL}/`, {
            to,
            message,
        }, {
            headers: {
                'Authorization': process.env.SMS_GATEWAY_API_KEY_CLOUD,
                'Content-Type': 'application/json',
            },
        });
        logger.info(`Traccar SMS Gateway sent (${context}): ${JSON.stringify(response.data)}`);
        return { success: true, method: 'SMS' };
    } catch (error) {
        logger.error(`Traccar SMS Gateway error (${context}): ${error.response?.data || error.message}`);

        try {
            const email = await findEmailByPhone(to);
            if (email) {
                const subject = context === 'otp' ? 'TraceFlow OTP (SMS Failed)' : 'TraceFlow Notification (SMS Failed)';
                const text = context === 'otp'
                    ? `We couldn’t send your OTP via SMS. Your OTP is: ${message.match(/\d{6}/)[0]}. It expires in 10 minutes.`
                    : `We couldn’t send you an SMS. Here’s your message:\n\n${message}\n\nPlease update your phone number if necessary.`;
                await transporter.sendMail({
                    from: process.env.SMTP_USER,
                    to: email,
                    subject,
                    text,
                });
                logger.info(`Fallback email sent to ${email} (${context})`);
                return { success: true, method: 'Email', fallback: true };
            }
            logger.info(`No email found for phone: ${to} (${context})`);
            return { success: false, method: 'None', reason: 'No SMS or email available' };
        } catch (emailError) {
            logger.error(`Email fallback error (${context}): ${emailError.message}`);
            return { success: false, method: 'None', reason: 'Failed to send SMS and email' };
        }
    }
}

async function findEmailByPhone(phone) {
    let email = null;
    const user = await User.findOne({ where: { phone } });
    if (user) {
        email = user.email;
    } else {
        const agent = await Agent.findOne({ where: { phone } });
        email = agent?.email || null;
    }
    logger.info(`Email lookup result: ${email || 'Not found'}`);
    return email;
}

async function initializeSMS() {
    try {
        // Optional: Add a health check for SMS gateway if your provider supports it
        logger.info(`SMS gateway initialized`);
        return true;
    } catch (error) {
        logger.error(`SMS initialization error: ${error.message}`);
        throw error;
    }
}

module.exports = { sendSMS, initializeSMS };