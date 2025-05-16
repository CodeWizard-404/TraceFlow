const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

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

// Load and render an email template from the emailTemplates directory
async function loadEmailTemplate(templateName, replacements = {}) {
    try {
        const templatePath = path.join(__dirname, '..', 'emailTemplates', `${templateName}.html`);
        let templateContent = await fs.readFile(templatePath, 'utf-8');

        // Replace placeholders in the template
        for (const [key, value] of Object.entries(replacements)) {
            const resolvedValue = await Promise.resolve(value); // Resolve any Promises
            templateContent = templateContent.replace(new RegExp(`{{${key}}}`, 'g'), String(resolvedValue || ''));
        }

        return templateContent;
    } catch (error) {
        logger.error(`Failed to load email template: ${templateName}`, {
            route: 'smtp',
            service: 'email',
            message: error.message,
        });
        throw new Error(`Failed to load email template: ${templateName}`);
    }
}

// Send an email with a specified template or default template
async function sendEmail({ to, subject, templateName, replacements = {}, textFallback = '' }) {
    try {
        // Validate inputs
        if (typeof textFallback !== 'string') {
            const resolvedTextFallback = await Promise.resolve(textFallback);
            textFallback = String(resolvedTextFallback || '');
            logger.warn(`textFallback was not a string, resolved to: ${textFallback}`, {
                route: 'smtp',
                service: 'email',
            });
        }
        if (replacements.content && typeof replacements.content !== 'string') {
            replacements.content = await Promise.resolve(replacements.content).then(String);
            logger.warn(`replacements.content was not a string, resolved to: ${replacements.content}`, {
                route: 'smtp',
                service: 'email',
            });
        }

        let htmlContent;
        if (templateName) {
            htmlContent = await loadEmailTemplate(templateName, {
                subject,
                ...replacements,
                platformUrl: process.env.PLATFORM_URL || 'https://traceflow.example.com',
                supportEmail: process.env.SUPPORT_EMAIL || 'support@traceflow.example.com',
            });
        } else {
            htmlContent = await loadEmailTemplate('default', {
                subject,
                content: textFallback || 'Please check your account for more details.',
                firstname: replacements.firstname || 'User',
                platformUrl: process.env.PLATFORM_URL || 'https://traceflow.example.com',
                supportEmail: process.env.SUPPORT_EMAIL || 'support@traceflow.example.com',
            });
        }

        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to,
            subject,
            html: htmlContent,
            text: textFallback,
        });

        logger.info(`Email sent successfully to ${to}`, {
            route: 'smtp',
            service: 'email',
            subject,
        });
    } catch (error) {
        logger.error(`Failed to send email to ${to}`, {
            route: 'smtp',
            service: 'email',
            message: error.message,
        });
        throw error;
    }
}

module.exports = { transporter, initializeSMTP, loadEmailTemplate, sendEmail };