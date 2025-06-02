const CsvHeaderService = require('../services/csvHeaderService');
const logger = require('../utils/logger');

/**
 * Controller for managing CSV header-related operations.
 */
class CsvHeaderController {
    /**
     * Get CSV header mappings.
     * @param {Object} req - Express request object with csvType in query.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with headers or error.
     */
    static async getHeaders(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { csvType } = req.query;
            if (!csvType) {
                logger.warn('Failed to fetch CSV headers: Missing csvType', {
                    route: 'csv-headers',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'csvType is required' });
            }
            const headers = await CsvHeaderService.getHeaders(csvType);
            logger.info('Successfully fetched CSV headers', {
                route: 'csv-headers',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { csvType, headerCount: headers.length }
            });
            return res.status(200).json({ headers });
        } catch (error) {
            logger.error('Failed to fetch CSV headers', {
                route: 'csv-headers',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Update or create CSV header mappings.
     * @param {Object} req - Express request object with csvType and headers in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with success message or error.
     */
    static async updateHeaders(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { csvType, headers } = req.body;
            if (!csvType || !headers || !Array.isArray(headers)) {
                logger.warn('Failed to update CSV headers: Missing or invalid csvType or headers', {
                    route: 'csv-headers',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { csvType }
                });
                return res.status(400).json({ error: 'csvType and headers array are required' });
            }
            const result = await CsvHeaderService.updateHeaders(csvType, headers, actorID);
            if (!result.success) {
                logger.warn('Failed to update or create CSV headers', {
                    route: 'csv-headers',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { csvType, requestBody: req.body, error: result.message }
                });
                return res.status(400).json({ error: result.message });
            }
            logger.info('Successfully updated or created CSV headers', {
                route: 'csv-headers',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { requestBody: req.body, csvType, headerCount: headers.length }
            });
            return res.status(200).json({ message: result.message });
        } catch (error) {
            logger.error('Failed to update or create CSV headers', {
                route: 'csv-headers',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = CsvHeaderController;