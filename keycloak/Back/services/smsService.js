const axios = require('axios');
require('dotenv').config();

const SMS_API_URL = process.env.SMS_API_URL;
const SMS_API_KEY = process.env.SMS_API_KEY;

async function sendGenericSMS(destNum, msg, label, ref) {
    try {
        const response = await axios.post(`${SMS_API_URL}send_generic`, {
            dest_num: destNum,
            msg,
            type: 0,
            auto_detect: 1,
            dt: new Date().toLocaleDateString('fr-FR', { timeZone: 'UTC' }),
            hr: new Date().getUTCHours(),
            mn: new Date().getUTCMinutes(),
            label,
            ref,
        }, {
            headers: {
                'X-API-Key': SMS_API_KEY,
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    } catch (error) {
        console.error('SMS API error:', error.response?.data || error.message);
        throw error;
    }
}

async function sendCustomSMS(custMsg, label, ref) {
    try {
        const response = await axios.post(`${SMS_API_URL}send_custom`, {
            cust_msg: custMsg,
            type: 0,
            auto_detect: 1,
            dt: new Date().toLocaleDateString('fr-FR', { timeZone: 'UTC' }),
            hr: new Date().getUTCHours(),
            mn: new Date().getUTCMinutes(),
            label,
            ref,
        }, {
            headers: {
                'X-API-Key': SMS_API_KEY,
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    } catch (error) {
        console.error('SMS API error:', error.response?.data || error.message);
        throw error;
    }
}

module.exports = { sendGenericSMS, sendCustomSMS };