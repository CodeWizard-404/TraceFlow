const { Op } = require('sequelize');
const CryptoJS = require('crypto-js');

// Configuration
const config = {
    encryptionKey: process.env.LOG_SECRET || 'default-secret',
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE) || 50,
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE) || 1000,
    archiveRetentionDays: parseInt(process.env.ARCHIVE_RETENTION_DAYS) || 30,
};

class SystemService {
    constructor(LogModel) {
        this.Log = LogModel;
    }

    /**
     * Fetch logs with pagination, filtering, and sorting
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Paginated logs
     */
    async getLogs({
        page = 1,
        pageSize = config.defaultPageSize,
        level,
        route,
        service,
        status,
        method,
        userId,
        traceId,
        startDate,
        endDate,
        search,
        sortBy = 'timestamp',
        sortOrder = 'DESC',
    }) {
        try {
            pageSize = Math.min(pageSize, config.maxPageSize);
            const offset = (page - 1) * pageSize;

            const where = {};
            if (level) where.level = level;
            if (route) where.route = route;
            if (service) where.service = service;
            if (status) where.status = status;
            if (method) where.method = method;
            if (userId) where.userId = userId;
            if (traceId) where.traceId = traceId;
            if (startDate || endDate) {
                where.timestamp = {};
                if (startDate) where.timestamp[Op.gte] = new Date(startDate);
                if (endDate) where.timestamp[Op.lte] = new Date(endDate);
            }
            if (search) {
                where[Op.or] = [
                    { message: { [Op.like]: `%${search}%` } },
                    { url: { [Op.like]: `%${search}%` } },
                ];
            }

            const { count, rows } = await this.Log.findAndCountAll({
                where,
                limit: pageSize,
                offset,
                order: [[sortBy, sortOrder]],
                paranoid: false, // Include soft-deleted logs if needed
            });

            // Decrypt sensitive metadata fields
            const decryptedRows = rows.map(row => {
                const log = row.toJSON();
                if (log.metadata) {
                    Object.keys(log.metadata).forEach(key => {
                        if (log.metadata[`${key}Encrypted`]) {
                            const bytes = CryptoJS.AES.decrypt(log.metadata[key], config.encryptionKey);
                            log.metadata[key] = bytes.toString(CryptoJS.enc.Utf8);

                        }
                    });
                }
                return log;
            });


            return {
                data: decryptedRows,
                total: count,
                page,
                pageSize,
                totalPages: Math.ceil(count / pageSize),
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get logs grouped by a specific category
     * @param {string} category - Field to group by (e.g., level, route, service)
     * @param {Object} filters - Additional filters
     * @returns {Promise<Array>} Aggregated log data
     */
    async getLogsByCategory(category, { startDate, endDate, level, route, service }) {
        try {
            const validCategories = ['level', 'route', 'service', 'status', 'method'];
            if (!validCategories.includes(category)) {
                throw new Error(`Invalid category: ${category}`);
            }

            const where = {};
            if (startDate || endDate) {
                where.timestamp = {};
                if (startDate) where.timestamp[Op.gte] = new Date(startDate);
                if (endDate) where.timestamp[Op.lte] = new Date(endDate);
            }
            if (level) where.level = level;
            if (route) where.route = route;
            if (service) where.service = service;

            const results = await this.Log.findAll({
                attributes: [
                    category,
                    [this.Log.sequelize.fn('COUNT', this.Log.sequelize.col(category)), 'count'],
                ],
                where,
                group: [category],
                order: [[this.Log.sequelize.literal('count'), 'DESC']],
            });

            return results.map(row => row.toJSON());
        } catch (error) {
            throw error;
        }
    }

    /**
     * Delete logs based on filters
     * @param {Object} filters - Deletion criteria
     * @returns {Promise<number>} Number of deleted logs
     */
    async deleteLogs({ level, route, service, status, method, userId, traceId, startDate, endDate }) {
        try {
            const where = {};
            if (level) where.level = level;
            if (route) where.route = route;
            if (service) where.service = service;
            if (status) where.status = status;
            if (method) where.method = method;
            if (userId) where.userId = userId;
            if (traceId) where.traceId = traceId;
            if (startDate || endDate) {
                where.timestamp = {};
                if (startDate) where.timestamp[Op.gte] = new Date(startDate);
                if (endDate) where.timestamp[Op.lte] = new Date(endDate);
            }

            const deletedCount = await this.Log.destroy({ where });

            return deletedCount;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Archive old logs to reduce database size
     * @param {number} retentionDays - Days to keep logs
     * @returns {Promise<number>} Number of archived logs
     */
    async archiveLogs(retentionDays = config.archiveRetentionDays) {
        try {
            const thresholdDate = new Date();
            thresholdDate.setDate(thresholdDate.getDate() - retentionDays);

            const deletedCount = await this.Log.destroy({
                where: {
                    timestamp: { [Op.lte]: thresholdDate },
                },
            });

            return deletedCount;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get log statistics (counts, trends, etc.)
     * @param {Object} options - Filter and time range options
     * @returns {Promise<Object>} Log statistics
     */
    async getLogStatistics({ startDate, endDate, route, service, level }) {
        try {
            const where = {};
            if (startDate || endDate) {
                where.timestamp = {};
                if (startDate) where.timestamp[Op.gte] = new Date(startDate);
                if (endDate) where.timestamp[Op.lte] = new Date(endDate);
            }
            if (route) where.route = route;
            if (service) where.service = service;
            if (level) where.level = level;

            const [total, byLevel, byRoute, byService, byStatus] = await Promise.all([
                this.Log.count({ where }),
                this.Log.findAll({
                    attributes: [
                        'level',
                        [this.Log.sequelize.fn('COUNT', this.Log.sequelize.col('level')), 'count'],
                    ],
                    where,
                    group: ['level'],
                }),
                this.Log.findAll({
                    attributes: [
                        'route',
                        [this.Log.sequelize.fn('COUNT', this.Log.sequelize.col('route')), 'count'],
                    ],
                    where,
                    group: ['route'],
                }),
                this.Log.findAll({
                    attributes: [
                        'service',
                        [this.Log.sequelize.fn('COUNT', this.Log.sequelize.col('service')), 'count'],
                    ],
                    where,
                    group: ['service'],
                }),
                this.Log.findAll({
                    attributes: [
                        'status',
                        [this.Log.sequelize.fn('COUNT', this.Log.sequelize.col('status')), 'count'],
                    ],
                    where,
                    group: ['status'],
                }),
            ]);

            return {
                total,
                byLevel: byLevel.map(row => row.toJSON()),
                byRoute: byRoute.map(row => row.toJSON()),
                byService: byService.map(row => row.toJSON()),
                byStatus: byStatus.map(row => row.toJSON()),
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Export logs to JSON format
     * @param {Object} filters - Export filters
     * @returns {Promise<Array>} Exported logs
     */
    async exportLogs({ level, route, service, status, startDate, endDate }) {
        try {
            const where = {};
            if (level) where.level = level;
            if (route) where.route = route;
            if (service) where.service = service;
            if (status) where.status = status;
            if (startDate || endDate) {
                where.timestamp = {};
                if (startDate) where.timestamp[Op.gte] = new Date(startDate);
                if (endDate) where.timestamp[Op.lte] = new Date(endDate);
            }

            const logs = await this.Log.findAll({ where });
            const decryptedLogs = logs.map(log => {
                const logData = log.toJSON();
                if (logData.metadata) {
                    Object.keys(logData.metadata).forEach(key => {
                        if (logData.metadata[`${key}Encrypted`]) {
                            const bytes = CryptoJS.AES.decrypt(logData.metadata[key], config.encryptionKey);
                            logData.metadata[key] = bytes.toString(CryptoJS.enc.Utf8);

                        }
                    });
                }
                return logData;
            });

            return decryptedLogs;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Clear all logs (use with caution)
     * @returns {Promise<number>} Number of deleted logs
     */
    async clearAllLogs() {
        try {
            const deletedCount = await this.Log.destroy({ where: {}, truncate: true });

            return deletedCount;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get unique values for a specific field
     * @param {string} field - Field to get unique values for
     * @returns {Promise<Array>} Unique values
     */
    async getUniqueValues(field) {
        try {
            const validFields = ['level', 'route', 'service', 'status', 'method', 'userId'];
            if (!validFields.includes(field)) {
                throw new Error(`Invalid field: ${field}`);
            }

            const results = await this.Log.findAll({
                attributes: [[this.Log.sequelize.fn('DISTINCT', this.Log.sequelize.col(field)), field]],
                where: { [field]: { [Op.ne]: null } },
            });

            return results.map(row => row[field]);
        } catch (error) {
            throw error;
        }
    }
}

module.exports = SystemService;