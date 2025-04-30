const axios = require('axios');
const { User, Agent } = require('../models');
const { transporter } = require('./smtp');
const logger = require('../utils/logger');
require('dotenv').config();

async function sendSMS(to, message, context = 'general') {
    try {
        const date = new Date().toLocaleDateString('fr-FR', { timeZone: 'UTC' });
        const hour = new Date().getUTCHours();
        const minute = new Date().getUTCMinutes();
        const label = 'NG Trend'; // Replace with your label
        const reference = `test ${context} SMS`; // Replace with your reference

        const url = `${process.env.SMS_API_URL}send_generic`;
        const headers = {
            'X-API-Key': process.env.SMS_API_KEY,
            'Content-Type': 'application/json',
        };
        const payload = {
            dest_num: to,
            msg: message,
            type: 0,
            auto_detect: 1,
            dt: date,
            hr: hour,
            mn: minute,
            label,
            ref: reference,
        };

        logger.info(`Sending SMS request to ${url} with headers: ${JSON.stringify(headers)} and payload: ${JSON.stringify(payload)}`);

        const response = await axios.post(url, payload, { headers });

        if (response.data && response.data.status && response.data.status !== 0) {
            logger.error(`w-Board SMS Gateway error (${context}): ${JSON.stringify(response.data)}`);
            throw new Error(`SMS sending failed with status: ${response.data.status} - ${response.data.status_desc}`);
        }

        logger.info(`w-Board SMS Gateway sent (${context}): ${JSON.stringify(response.data)}`);
        return { success: true, method: 'SMS' };
    } catch (error) {
        logger.error(`w-Board SMS Gateway error (${context}): ${error.response?.data || error.message}`);

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
        const url = `${process.env.SMS_API_URL}enquire_credit`;
        const headers = {
            'X-API-Key': process.env.SMS_API_KEY,
            'Content-Type': 'application/json',
        };

        logger.info(`Initializing SMS gateway with URL: ${url} and headers: ${JSON.stringify(headers)}`);

        const response = await axios.get(url, { headers });

        if (response.data && response.data.status === 0) {
            logger.info(`SMS gateway initialized successfully: ${JSON.stringify(response.data)}`);
            return { success: true, message: 'SMS gateway initialized successfully' };
        } else {
            logger.error(`SMS gateway initialization failed: ${JSON.stringify(response.data)}`);
            throw new Error(`SMS gateway initialization failed with status: ${response.data.status} - ${response.data.status_desc}`);
        }
    } catch (error) {
        logger.error(`SMS gateway initialization error: ${error.response?.data || error.message}`);
        throw new Error(`SMS gateway initialization error: ${error.message}`);
    }
}

module.exports = { sendSMS, initializeSMS };