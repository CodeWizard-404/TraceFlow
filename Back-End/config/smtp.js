const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT === '465', // Use SSL for port 465
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

async function initializeSMTP() {
    try {
        await transporter.verify();
        console.log('SMTP server ready.');
    } catch (error) {
        console.error('SMTP configuration error:', error);
        throw error;
    }
}

module.exports = { transporter, initializeSMTP };