const axios = require('axios');
require('dotenv').config();

async function sendSMS(to, message) {
  try {
    const response = await axios.post('https://api.textlocal.in/send/', {
      apikey: process.env.TEXTLOCAL_API_KEY,
      numbers: to, // e.g., "21620031474"
      message: message, // e.g., "Your SmartSync 2FA code is 123456"
      sender: 'TXTLCL', // Default sender ID (configurable in TextLocal)
    });
    console.log('TextLocal SMS sent:', response.data);
  } catch (error) {
    console.error('TextLocal SMS error:', error.response?.data || error.message);
    throw error;
  }
}

async function initializeSMS() {
  try {
    console.log('TextLocal SMS gateway initialized');
    return true;
  } catch (error) {
    console.error('SMS initialization error:', error);
    throw error;
  }
}

module.exports = { sendSMS, initializeSMS };