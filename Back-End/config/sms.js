const axios = require('axios');
const { User, Agent } = require('../models'); 
const { transporter } = require('./smtp');
require('dotenv').config();

async function sendSMS(to, message) {
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
        console.log(`${new Date().toISOString()} - Traccar SMS Gateway sent:`, response.data);
        return { success: true, method: 'SMS' };
    } catch (error) {
        console.error(`${new Date().toISOString()} - Traccar SMS Gateway error:`, error.response?.data || error.message);

        try {
            const email = await findEmailByPhone(to);
            if (email) {
                await transporter.sendMail({
                    from: process.env.SMTP_USER,
                    to: email,
                    subject: 'TraceFlow Notification (SMS Failed)',
                    text: `We couldn’t send you an SMS. Here’s your message:\n\n${message}\n\nPlease update your phone number if necessary.`,
                });
                console.log(`${new Date().toISOString()} - Fallback email sent to ${email}`);
                return { success: true, method: 'Email', fallback: true };
            }
            console.log(`${new Date().toISOString()} - No email found for phone: ${to}`);
            return { success: false, method: 'None', reason: 'No SMS or email available' };
        } catch (emailError) {
            console.error(`${new Date().toISOString()} - Email fallback error:`, emailError.message);
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
    console.log(`${new Date().toISOString()} - Email lookup result: ${email || 'Not found'}`);
    return email;
}

async function initializeSMS() {
    try {
        return true;
    } catch (error) {
        throw error;
    }
}

module.exports = { sendSMS, initializeSMS };