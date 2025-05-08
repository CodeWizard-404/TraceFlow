const CsvHeaderService = require('../services/csvHeaderService');
const logger = require('../utils/logger');

class CsvHeaderController {
    /**
     * Get CSV header mappings.
     * @param {Object} req - Express request object with csvType in query.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with headers or error.
     */
    static async getHeaders(req, res) {
        try {
            const { csvType } = req.query;
            const headers = await CsvHeaderService.getHeaders(csvType || 'agent');
            logger.info(`Fetched CSV headers for csvType ${csvType || 'agent'} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json({ headers });
        } catch (error) {
            logger.error(`Get CSV headers error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Update CSV header mappings.
     * @param {Object} req - Express request object with csvType and headers in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with success message or error.
     */
    static async updateHeaders(req, res) {
        try {
            const { csvType = 'agent', headers } = req.body;
            if (!headers) {
                logger.warn(`Update CSV headers failed: Missing headers, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Headers array is required' });
            }
            const result = await CsvHeaderService.updateHeaders(csvType, headers, req.user.userID);
            if (!result.success) {
                return res.status(400).json({ error: result.message });
            }
            logger.info(`Updated CSV headers for csvType ${csvType} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json({ message: result.message });
        } catch (error) {
            logger.error(`Update CSV headers error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = CsvHeaderController;