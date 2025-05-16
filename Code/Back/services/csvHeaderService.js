const CsvHeader = require('../models').CsvHeader;

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
            return [];
        }
    }

    /**
     * Update or create CSV header mappings for a given CSV type.
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

            const mappedHeaders = headers.map(h => h.mappedHeader);
            if (new Set(mappedHeaders).size !== mappedHeaders.length) {
                return { success: false, message: 'Mapped headers must be unique' };
            }
            if (mappedHeaders.some(h => !h || typeof h !== 'string')) {
                return { success: false, message: 'Mapped headers must be non-empty strings' };
            }
            if (headers.some(h => !h.expectedHeader || typeof h.expectedHeader !== 'string')) {
                return { success: false, message: 'Expected headers must be non-empty strings' };
            }

            // Validate expected headers
            const validExpectedHeaders = ['name', 'lastname', 'phone', 'email', 'delegation', 'supervisor_phone', 'governorate', 'lat', 'lng'];
            if (headers.some(h => !validExpectedHeaders.includes(h.expectedHeader))) {
                return { success: false, message: `Invalid expected headers: ${headers.filter(h => !validExpectedHeaders.includes(h.expectedHeader)).map(h => h.expectedHeader).join(', ')}` };
            }

            const existingHeaders = await CsvHeader.findAll({
                where: { csvType },
                transaction,
            });

            const existingHeaderMap = new Map(existingHeaders.map(h => [h.expectedHeader, h]));

            for (const header of headers) {
                const { expectedHeader, mappedHeader } = header;

                if (existingHeaderMap.has(expectedHeader)) {
                    await CsvHeader.update(
                        { mappedHeader },
                        {
                            where: { csvType, expectedHeader },
                            transaction,
                        }
                    );
                } else {
                    await CsvHeader.create(
                        { csvType, expectedHeader, mappedHeader, createdBy: actorID },
                        { transaction }
                    );
                }
            }

            await transaction.commit();
            return { success: true, message: 'Headers updated successfully' };
        } catch (error) {
            await transaction.rollback();
            console.error('Failed to update headers:', error);
            return { success: false, message: `Unable to update headers: ${error.message}` };
        }
    }
}

module.exports = CsvHeaderService;