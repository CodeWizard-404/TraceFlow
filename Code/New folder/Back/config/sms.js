const axios = require('axios');
const https = require('https');
const { User, Agent } = require('../models');
const { transporter } = require('./smtp');
const logger = require('../utils/logger');
require('dotenv').config();

async function sendSMS(to, message, context = 'general') {
    try {
        const date = new Date().toLocaleDateString('fr-FR', { timeZone: 'UTC' });
        const hour = new Date().getUTCHours();
        const minute = new Date().getUTCMinutes();
        const label = process.env.SMS_API_LABEL;
        const reference = process.env.SMS_API_REF;

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

        logger.info('Sending SMS', {
            route: 'sms',
            service: 'notification',
            to: payload.dest_num,
            message: payload.msg,
        });

        const response = await axios.post(url, payload, { headers });

        if (response.data && response.data.status && response.data.status !== 0) {
            logger.error('w-Board SMS Gateway error', {
                route: 'sms',
                service: 'notification',
                context,
                response: response.data,
            });
            throw new Error(`SMS sending failed with status: ${response.data.status} - ${response.data.status_desc}`);
        }

        return { success: true, method: 'SMS' };
    } catch (error) {
        logger.error('w-Board SMS Gateway error', {
            route: 'sms',
            service: 'notification',
            context,
            message: error.response?.data || error.message,
        });

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
                logger.info('Fallback email sent', {
                    route: 'email',
                    service: 'notification',
                    to: email,
                    context,
                });
                return {
                    success: true,
                    method: 'Email',
                    fallback: true,
                    fallbackReason: error.response?.data?.status_desc || 'Invalid or unreachable phone number',
                };
            }
            return { success: false, method: 'None', reason: 'No SMS or email available' };
        } catch (emailError) {
            logger.error('Email fallback error', {
                route: 'email',
                service: 'notification',
                context,
                message: emailError.message,
            });
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
    return email;
}

async function initializeSMS() {
    try {
        const url = `${process.env.SMS_API_URL}enquire_credit`;
        const headers = {
            'X-API-Key': process.env.SMS_API_KEY,
            'Content-Type': 'application/json',
        };

        // Create an HTTPS agent that bypasses SSL verification (development only)
        const agent = new https.Agent({
            rejectUnauthorized: false, // Ignore SSL certificate errors
        });

        const response = await axios.get(url, {
            headers,
            httpsAgent: agent, // Use the custom agent
        });

        if (response.data && response.data.status === 0) {
            logger.info('SMS gateway initialized successfully', {
                route: 'sms',
                service: 'notification',
            });
            return { success: true, message: 'SMS gateway initialized successfully' };
        } else {
            logger.error('SMS gateway initialization failed', {
                route: 'sms',
                service: 'notification',
                response: response.data,
            });
            throw new Error(`SMS gateway initialization failed with status: ${response.data.status} - ${response.data.status_desc}`);
        }
    } catch (error) {
        logger.error('SMS gateway initialization error', {
            route: 'sms',
            service: 'notification',
            message: error.response?.data || error.message,
        });
        throw new Error(`SMS gateway initialization error: ${error.message}`);
    }

}

module.exports = { sendSMS, initializeSMS };