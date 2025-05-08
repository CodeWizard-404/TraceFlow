const CsvHeader = require('../models').CsvHeader;
const logger = require('../utils/logger');

class CsvHeaderService {
    /**
     * Get all CSV header mappings for a given CSV type.
     * @param {string} csvType - Type of CSV (e.g., 'agent').
     * @returns {Promise<Array>} List of header mappings.
     */
    static async getHeaders(csvType = 'agent') {
        try {
            const headers = await CsvHeader.findAll({
                where: { csvType },
                attributes: ['headerID', 'csvType', 'expectedHeader', 'mappedHeader'],
            });
            return headers || [];
        } catch (error) {
            logger.error(`Get CSV headers error: ${error.message}, csvType: ${csvType}`);
            return [];
        }
    }

    /**
     * Update CSV header mappings for a given CSV type.
     * @param {string} csvType - Type of CSV (e.g., 'agent').
     * @param {Array} headers - Array of { expectedHeader, mappedHeader } objects.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Success message or error response.
     */
    static async updateHeaders(csvType, headers, actorID) {
        const transaction = await CsvHeader.sequelize.transaction();
        try {
            // Validate inputs
            if (!Array.isArray(headers) || headers.length === 0) {
                return { success: false, message: 'Headers array is required and must not be empty' };
            }

            const existingHeaders = await CsvHeader.findAll({
                where: { csvType },
                transaction,
            });

            // Validate that all expected headers are provided
            const expectedHeadersSet = new Set(existingHeaders.map(h => h.expectedHeader));
            const providedHeadersSet = new Set(headers.map(h => h.expectedHeader));
            if (expectedHeadersSet.size !== providedHeadersSet.size ||
                [...expectedHeadersSet].some(h => !providedHeadersSet.has(h))) {
                return { success: false, message: 'All expected headers must be provided' };
            }

            // Validate mapped headers for uniqueness and non-emptiness
            const mappedHeaders = headers.map(h => h.mappedHeader);
            if (new Set(mappedHeaders).size !== mappedHeaders.length) {
                return { success: false, message: 'Mapped headers must be unique' };
            }
            if (mappedHeaders.some(h => !h || typeof h !== 'string')) {
                return { success: false, message: 'Mapped headers must be non-empty strings' };
            }

            // Update headers
            for (const header of headers) {
                await CsvHeader.update(
                    { mappedHeader: header.mappedHeader },
                    {
                        where: {
                            csvType,
                            expectedHeader: header.expectedHeader,
                        },
                        transaction,
                    }
                );
            }

            await transaction.commit();
            logger.info(`Updated CSV headers for csvType ${csvType} by user ${actorID}`);
            return { success: true, message: 'Headers updated successfully' };
        } catch (error) {
            await transaction.rollback();
            logger.error(`Update CSV headers error: ${error.message}, user: ${actorID}, csvType: ${csvType}`);
            return { success: false, message: 'Unable to update headers' };
        }
    }
}

module.exports = CsvHeaderService;