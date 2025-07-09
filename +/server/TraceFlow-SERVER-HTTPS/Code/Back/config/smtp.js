const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
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
        logger.info('SMTP server verified successfully', {
            route: 'smtp',
            service: 'email',
        });
        return true;
    } catch (error) {
        logger.error('SMTP verification error', {
            route: 'smtp',
            service: 'email',
            message: error.message,
        });
        throw error;
    }
}

module.exports = { transporter, initializeSMTP };