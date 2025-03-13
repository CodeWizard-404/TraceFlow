const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,  
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Verifies SMTP configuration and ensures the server is ready
async function initializeSMTP() {
    try {
        console.log(`${new Date().toISOString()} - Verifying SMTP connection to ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}...`);
        await transporter.verify();
        console.log(`${new Date().toISOString()} - SMTP server ready`);
    } catch (error) {
        console.error(`${new Date().toISOString()} - SMTP configuration error:`, error);
        throw error; // Re-throw to be caught by the caller
    }
}

module.exports = { transporter, initializeSMTP };