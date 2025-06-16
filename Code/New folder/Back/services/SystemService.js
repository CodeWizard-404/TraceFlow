const { Op } = require('sequelize');
const CryptoJS = require('crypto-js');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const config = {
    encryptionKey: process.env.LOG_SECRET || 'default-secret',
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE) || 50,
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE) || 1000,
    archiveRetentionDays: parseInt(process.env.ARCHIVE_RETENTION_DAYS) || 30,
    baseLogDir: path.join(__dirname, '../logs'),
};

// Route-specific log directories 
const routeLogDirs = {
    auth: 'auth',
    users: 'users',
    roles: 'roles',
    permissions: 'permissions',
    visits: 'visits',
    checklists: 'checklists',
    reasons: 'reasons',
    timesheets: 'timesheets',
    agents: 'agents',
    'receipt-books': 'receipt-books',
    'receipt-stubs': 'receipt-stubs',
    notifications: 'notifications',
    locations: 'locations',
    'csv-headers': 'csv-headers',
    general: 'general',
};

class SystemService {
    constructor(LogModel) {
        this.Log = LogModel;
        this.ensureLogDirectories();
    }

    async ensureLogDirectories() {
        try {
            for (const routeKey of Object.keys(routeLogDirs)) {
                const logDir = path.join(config.baseLogDir, routeLogDirs[routeKey]);
                await fs.mkdir(logDir, { recursive: true });
                const logPath = path.join(logDir, `${routeLogDirs[routeKey]}.log`);
                if (!(await fs.access(logPath).then(() => true).catch(() => false))) {
                    await fs.writeFile(logPath, '');
                }
            }
        } catch (error) {
            console.error('Error ensuring log directories:', error.message);
        }
    }

    /**
     * Helper function to delete logs from files based on filters
     * @param {Object} filters - Deletion criteria
     */
    async deleteLogsFromFiles({ level, route, service, status, method, userId, traceId, startDate, endDate }) {
        try {
            const routes = route ? [route] : Object.keys(routeLogDirs);
            let deletedCount = 0;

            for (const routeKey of routes) {
                const logDir = path.join(config.baseLogDir, routeLogDirs[routeKey] || 'general');
                const logPath = path.join(logDir, `${routeLogDirs[routeKey] || 'general'}.log`);

                if (!(await fs.access(logPath).then(() => true).catch(() => false))) {
                    continue;
                }

                const fileContent = await fs.readFile(logPath, 'utf8');
                const lines = fileContent.split('\n').filter(line => line.trim());
                const filteredLogs = [];

                for (const line of lines) {
                    try {
                        const log = JSON.parse(line);
                        let deleteLog = true;

                        // Check if log matches all provided filters (delete if it matches)
                        if (level && log.level !== level) deleteLog = false;
                        if (route && log.route !== route) deleteLog = false;
                        if (service && log.service !== service) deleteLog = false;
                        if (status && log.status !== status) deleteLog = false;
                        if (method && log.method !== method) deleteLog = false;
                        if (userId && log.userId !== userId) deleteLog = false;
                        if (traceId && log.traceId !== traceId) deleteLog = false;
                        if (startDate && new Date(log.timestamp) < new Date(startDate)) deleteLog = false;
                        if (endDate && new Date(log.timestamp) > new Date(endDate)) deleteLog = false;

                        if (!deleteLog) {
                            filteredLogs.push(line);
                        } else {
                            deletedCount++;
                        }
                    } catch (error) {
                        console.error(`Error parsing log line in ${logPath}:`, error.message);
                    }
                }

                if (filteredLogs.length < lines.length) {
                    await fs.writeFile(logPath, filteredLogs.join('\n') + (filteredLogs.length ? '\n' : ''));
                } else {
                    console.log(`No logs deleted in ${logPath}, no need to rewrite file`);
                }
            }

            return deletedCount;
        } catch (error) {
            throw new Error(`Failed to delete logs from files: ${error.message}`);
        }
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
        sortOrder = 'desc',
        includeDeleted = false, // New parameter
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
                paranoid: !includeDeleted,
            });

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

            const result = {
                data: decryptedRows,
                total: count,
                page,
                pageSize,
                totalPages: Math.ceil(count / pageSize),
            };
            return result;
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
                order: [[this.Log.sequelize.literal('count'), 'desc']],
            });

            const formattedResults = results.map(row => row.toJSON());
            return formattedResults;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Delete logs based on filters from database and files
     * @param {Object} filters - Deletion criteria
     * @returns {Promise<Object>} Number of deleted logs from database and files
     */
    async deleteLogs({ level, route, service, status, method, userId, traceId, startDate, endDate, force = false }) {
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

            const dbDeletedCount = await this.Log.destroy({ where, force });

            let fileDeletedCount = 0;
            if (!level && !route && !service && !status && !method && !userId && !traceId && !startDate && !endDate) {
                for (const routeKey of Object.keys(routeLogDirs)) {
                    const logPath = path.join(config.baseLogDir, routeLogDirs[routeKey], `${routeLogDirs[routeKey]}.log`);
                    if (await fs.access(logPath).then(() => true).catch(() => false)) {
                        const fileContent = await fs.readFile(logPath, 'utf8');
                        const lineCount = fileContent.split('\n').filter(line => line.trim()).length;
                        fileDeletedCount += lineCount;
                        await fs.writeFile(logPath, '');
                    } else {
                        console.log(`Log file does not exist: ${logPath}, skipping`);
                    }
                }
            } else {
                fileDeletedCount = await this.deleteLogsFromFiles({ level, route, service, status, method, userId, traceId, startDate, endDate });
            }

            const result = { dbDeletedCount, fileDeletedCount };
            return result;
        } catch (error) {
            throw error;
        }
    }

    async archiveLogs(retentionDays = config.archiveRetentionDays, force = false) {
        try {
            const thresholdDate = new Date();
            thresholdDate.setDate(thresholdDate.getDate() - retentionDays);

            const dbDeletedCount = await this.Log.destroy({
                where: {
                    timestamp: { [Op.lte]: thresholdDate },
                },
                force,
            });

            let fileDeletedCount = 0;
            for (const routeKey of Object.keys(routeLogDirs)) {
                const logDir = path.join(config.baseLogDir, routeLogDirs[routeKey]);
                const logPath = path.join(logDir, `${routeLogDirs[routeKey]}.log`);
                if (!(await fs.access(logPath).then(() => true).catch(() => false))) {
                    continue;
                }

                const fileContent = await fs.readFile(logPath, 'utf8');
                const lines = fileContent.split('\n').filter(line => line.trim());
                const filteredLogs = [];

                for (const line of lines) {
                    try {
                        const log = JSON.parse(line);
                        if (new Date(log.timestamp) > thresholdDate) {
                            filteredLogs.push(line);
                        } else {
                            fileDeletedCount++;
                        }
                    } catch (error) {
                    }
                }

                if (filteredLogs.length < lines.length) {
                    await fs.writeFile(logPath, filteredLogs.join('\n') + (filteredLogs.length ? '\n' : ''));
                } else {
                }
            }

            const result = { dbDeletedCount, fileDeletedCount };
            return result;
        } catch (error) {
            throw error;
        }
    }



    /**
     * Get enhanced log statistics including archived logs
     * @param {Object} options - Filter and time range options
     * @returns {Promise<Object>} Detailed log statistics
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

            const [total, byLevel, byRoute, byService, byStatus, byMethod, uniqueUsers, trends] = await Promise.all([
                this.Log.count({ where }).then(count => {
                    return count;
                }),
                this.Log.findAll({
                    attributes: [
                        'level',
                        [this.Log.sequelize.fn('COUNT', this.Log.sequelize.col('level')), 'count'],
                    ],
                    where,
                    group: ['level'],
                    raw: true, // Ensure raw results to avoid parsing issues
                }).then(results => {
                    return results;
                }),
                this.Log.findAll({
                    attributes: [
                        'route',
                        [this.Log.sequelize.fn('COUNT', this.Log.sequelize.col('route')), 'count'],
                    ],
                    where,
                    group: ['route'],
                    raw: true,
                }).then(results => {
                    return results;
                }),
                this.Log.findAll({
                    attributes: [
                        'service',
                        [this.Log.sequelize.fn('COUNT', this.Log.sequelize.col('service')), 'count'],
                    ],
                    where,
                    group: ['service'],
                    raw: true,
                }).then(results => {
                    return results;
                }),
                this.Log.findAll({
                    attributes: [
                        'status',
                        [this.Log.sequelize.fn('COUNT', this.Log.sequelize.col('status')), 'count'],
                    ],
                    where,
                    group: ['status'],
                    raw: true,
                }).then(results => {
                    return results;
                }),
                this.Log.findAll({
                    attributes: [
                        'method',
                        [this.Log.sequelize.fn('COUNT', this.Log.sequelize.col('method')), 'count'],
                    ],
                    where,
                    group: ['method'],
                    raw: true,
                }).then(results => {
                    return results;
                }),
                this.Log.findAll({
                    attributes: [[this.Log.sequelize.fn('DISTINCT', this.Log.sequelize.col('userId')), 'userId']],
                    where: { ...where, userId: { [Op.ne]: null } },
                    raw: true,
                }).then(results => {
                    return results;
                }),
                this.Log.findAll({
                    attributes: [
                        [this.Log.sequelize.fn('DATE', this.Log.sequelize.col('timestamp')), 'date'],
                        [this.Log.sequelize.fn('COUNT', this.Log.sequelize.col('logID')), 'count'],
                    ],
                    where,
                    group: [this.Log.sequelize.fn('DATE', this.Log.sequelize.col('timestamp'))],
                    order: [[this.Log.sequelize.fn('DATE', this.Log.sequelize.col('timestamp')), 'asc']],
                    raw: true,
                }).then(results => {
                    return results;
                }),
            ]);

            const archivedStats = { total: 0, byRoute: {}, byLevel: {}, byService: {}, byStatus: {}, byMethod: {} };
            const thresholdDate = new Date();
            thresholdDate.setDate(thresholdDate.getDate() - config.archiveRetentionDays);

            for (const routeKey of Object.keys(routeLogDirs)) {
                const logPath = path.join(config.baseLogDir, routeLogDirs[routeKey], `${routeLogDirs[routeKey]}.log`);
                if (!(await fs.access(logPath).then(() => true).catch(() => false))) {
                    continue;
                }

                const fileContent = await fs.readFile(logPath, 'utf8');
                const lines = fileContent.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    try {
                        const log = JSON.parse(line);
                        if (new Date(log.timestamp) <= thresholdDate) {
                            archivedStats.total++;
                            archivedStats.byRoute[log.route] = (archivedStats.byRoute[log.route] || 0) + 1;
                            archivedStats.byLevel[log.level] = (archivedStats.byLevel[log.level] || 0) + 1;
                            archivedStats.byService[log.service] = (archivedStats.byService[log.service] || 0) + 1;
                            archivedStats.byStatus[log.status] = (archivedStats.byStatus[log.status] || 0) + 1;
                            archivedStats.byMethod[log.method] = (archivedStats.byMethod[log.method] || 0) + 1;
                        }
                    } catch (error) {
                        console.error(`Error parsing archived log in ${logPath}:`, error.message);
                    }
                }
            }

            const result = {
                database: {
                    total,
                    byLevel,
                    byRoute,
                    byService,
                    byStatus,
                    byMethod,
                    uniqueUsers: uniqueUsers.length,
                    trends,
                },
                archived: archivedStats,
            };
            return result;
        } catch (error) {
            console.error('Error in getLogStatistics:', error.message);
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
     * Clear all logs from database and files
     * @returns {Promise<Object>} Number of deleted logs from database and files
     */
    async clearAllLogs() {
        try {
            const dbDeletedCount = await this.Log.destroy({ where: {}, truncate: true, force: true });

            let fileDeletedCount = 0;
            for (const routeKey of Object.keys(routeLogDirs)) {
                const logDir = path.join(config.baseLogDir, routeLogDirs[routeKey]);
                const logPath = path.join(logDir, `${routeLogDirs[routeKey]}.log`);
                try {
                    if (await fs.access(logPath).then(() => true).catch(() => false)) {
                        const fileContent = await fs.readFile(logPath, 'utf8');
                        const lineCount = fileContent.split('\n').filter(line => line.trim()).length;
                        fileDeletedCount += lineCount;
                        await fs.writeFile(logPath, '');
                    } else {
                        console.log(`Log file does not exist: ${logPath}, skipping`);
                    }
                } catch (error) {
                    console.error(`Error processing log file ${logPath}: ${error.message}`);
                }
            }

            const result = { dbDeletedCount, fileDeletedCount };
            return result;
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

            const uniqueValues = results.map(row => row[field]);
            return uniqueValues;
        } catch (error) {
            throw error;
        }
    }



}

module.exports = SystemService;