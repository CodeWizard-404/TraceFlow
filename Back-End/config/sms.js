const axios = require('axios');
const { User } = require('../models');
const { transporter } = require('./smtp');
require('dotenv').config();

// Sends an SMS via the Traccar SMS Gateway with email fallback
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
            const email = await findUserEmailByPhone(to);
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
            throw new Error('SMS failed and no email fallback available');
        } catch (emailError) {
            throw new Error('Failed to send SMS and email fallback');
        }
    }
}

// Helper function to find a user’s email by phone number
async function findUserEmailByPhone(phone) {
    const user = await User.findOne({ where: { phone } });
    console.log(`${new Date().toISOString()} - Email lookup result: ${user ? user.email : 'Not found'}`);
    return user ? user.email : null;
}

// Initializes the SMS gateway (currently a placeholder)
async function initializeSMS() {
    try {
        // Placeholder for actual initialization logic if needed
        return true;
    } catch (error) {
        throw error; // Re-throw to be caught by the caller
    }
}

module.exports = { sendSMS, initializeSMS };