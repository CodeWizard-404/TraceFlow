const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Verifies SMTP configuration and ensures the server is ready
async function initializeSMTP() {
    try {
        await transporter.verify();
        console.log(`${new Date().toISOString()} - SMTP server verified successfully`);
        return true;
    } catch (error) {
        console.error(`${new Date().toISOString()} - SMTP verification error:`, error.message);
        throw error; // Re-throw to be caught by the caller
    }
}

module.exports = { transporter, initializeSMTP };