const axios = require('axios');
const { transporter } = require('./smtp');
require('dotenv').config();

async function sendSMS(to, message) {
  try {
    //const response = await axios.post(`http://${process.env.SMS_GATEWAY_IP}:${process.env.SMS_GATEWAY_PORT}/`, {
    const response = await axios.post(`${process.env.SMS_GATEWAY_URL}/`, {
      to: to, // e.g., "+21620031474"
      message: message, // e.g., "Your TraceFlow 2FA code is 123456"
    }, {
      headers: {
        //'Authorization': process.env.SMS_GATEWAY_API_KEY_LOCAL, 
        'Authorization': process.env.SMS_GATEWAY_API_KEY_CLOUD,
        'Content-Type': 'application/json',
      },
    });
    console.log('Traccar SMS Gateway sent:', response.data);
  } catch (error) {
    console.error('Traccar SMS Gateway error:', error.response?.data || error.message);
    // Fallback to email if SMS fails
    try {
      const email = await findUserEmailByPhone(to);
      if (email) {
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: email,
          subject: 'TraceFlow Notification (SMS Failed)',
          text: `We couldn’t send you an SMS. Here’s your message:\n\n${message}\n\nPlease update your phone number if necessary.`,
        });
        console.log(`Fallback email sent to ${email}`);
        return { success: true, method: 'Email', fallback: true };
      } else {
        console.warn(`No email found for phone ${to}. Notification failed.`);
        throw new Error('SMS failed and no email fallback available');
      }
    } catch (emailError) {
      console.error('Email fallback failed:', emailError.message);
      throw new Error('Failed to send SMS and email fallback');
    }
  }
}

// Helper function to find user's email by phone (implement based on your models)
async function findUserEmailByPhone(phone) {
  const { User } = require('../models');
  const user = await User.findOne({ where: { phone } });
  return user ? user.email : null;
}

async function initializeSMS() {
  try {
    console.log('Traccar SMS Gateway initialized');
    return true;
  } catch (error) {
    console.error('SMS initialization error:', error);
    throw error;
  }
}

module.exports = { sendSMS, initializeSMS };