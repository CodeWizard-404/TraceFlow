const nodemailer = require('nodemailer');
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
        return true;
    } catch (error) {
        throw error;
    }
}

// Load and render an email template from the Templates directory
async function loadEmailTemplate(templateName, replacements = {}) {
    try {
        const templatePath = path.join(__dirname, '..', 'Templates', `${templateName}.html`);
        let templateContent = await fs.readFile(templatePath, 'utf-8');

        // Replace placeholders in the template
        for (const [key, value] of Object.entries(replacements)) {
            const resolvedValue = await Promise.resolve(value); // Resolve any Promises
            templateContent = templateContent.replace(new RegExp(`{{${key}}}`, 'g'), String(resolvedValue || ''));
        }

        return templateContent;
    } catch (error) {
        throw new Error(`Failed to load email template: ${templateName}`);
    }
}

// Send an email with a specified template or default template
async function sendEmail({ to, subject, templateName, replacements = {}, textFallback = '', attachments = [] }) {
    try {
        // Validate inputs
        if (typeof textFallback !== 'string') {
            const resolvedTextFallback = await Promise.resolve(textFallback);
            textFallback = String(resolvedTextFallback || '');
        }
        if (replacements.content && typeof replacements.content !== 'string') {
            replacements.content = await Promise.resolve(replacements.content).then(String);
        }

        // Handle logo and signature images as CID attachments
        const updatedReplacements = { ...replacements };
        const imageAttachments = [];
        const imageConfigs = [
            {
                key: 'logoUrl',
                cid: 'logo',
                primary: path.join(__dirname, '..', 'Templates', 'logo', 'Banner-wd.png'),
                fallback: path.join(__dirname, '..', '..', 'Front', 'public', 'Banner-wd.png'),
            },
            {
                key: 'signatureLogoUrl',
                cid: 'signature',
                primary: path.join(__dirname, '..', 'Templates', 'logo', 'Banner-bd.png'),
                fallback: path.join(__dirname, '..', '..', 'Front', 'public', 'Banner-bd.png'),
            },
        ];

        for (const { key, cid, primary, fallback } of imageConfigs) {
            if (updatedReplacements[key]) {
                let filePath = primary;
                try {
                    await fs.access(primary);
                } catch (error) {
                    filePath = fallback;
                }

                try {
                    const imageBuffer = await fs.readFile(filePath);
                    const mimeType = 'image/png'; // Static MIME type for PNG files
                    imageAttachments.push({
                        filename: path.basename(filePath),
                        content: imageBuffer,
                        cid: cid,
                    });
                    updatedReplacements[key] = `cid:${cid}`;
                } catch (error) {
                    updatedReplacements[key] = replacements[key] || process.env[key.toUpperCase()] || '';
                }
            }
        }

        let htmlContent;
        if (templateName) {
            htmlContent = await loadEmailTemplate(templateName, {
                subject,
                ...updatedReplacements,
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

        const mailOptions = {
            from: process.env.SMTP_USER,
            to,
            subject,
            html: htmlContent,
            text: textFallback,
            attachments: [...attachments, ...imageAttachments],
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        throw error;
    }
}

module.exports = { transporter, initializeSMTP, loadEmailTemplate, sendEmail };