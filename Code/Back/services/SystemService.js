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
        console.log('SystemService initialized with LogModel');
        this.ensureLogDirectories();
    }

    async ensureLogDirectories() {
        try {
            console.log('Ensuring log directories exist');
            for (const routeKey of Object.keys(routeLogDirs)) {
                const logDir = path.join(config.baseLogDir, routeLogDirs[routeKey]);
                console.log(`Creating log directory: ${logDir}`);
                await fs.mkdir(logDir, { recursive: true });
                const logPath = path.join(logDir, `${routeLogDirs[routeKey]}.log`);
                if (!(await fs.access(logPath).then(() => true).catch(() => false))) {
                    console.log(`Creating empty log file: ${logPath}`);
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
        console.log('Starting deleteLogsFromFiles with filters:', { level, route, service, status, method, userId, traceId, startDate, endDate });
        const routes = route ? [route] : Object.keys(routeLogDirs);
        console.log('Routes to process:', routes);
        let deletedCount = 0;

        for (const routeKey of routes) {
            const logDir = path.join(config.baseLogDir, routeLogDirs[routeKey] || 'general');
            const logPath = path.join(logDir, `${routeLogDirs[routeKey] || 'general'}.log`);
            console.log(`Processing log file: ${logPath}`);

            if (!(await fs.access(logPath).then(() => true).catch(() => false))) {
                console.log(`Log file does not exist: ${logPath}, skipping`);
                continue;
            }

            console.log(`Reading log file: ${logPath}`);
            const fileContent = await fs.readFile(logPath, 'utf8');
            const lines = fileContent.split('\n').filter(line => line.trim());
            console.log(`Found ${lines.length} log lines in ${logPath}`);
            const filteredLogs = [];

            for (const line of lines) {
                try {
                    const log = JSON.parse(line);
                    console.log(`Parsed log entry: ${JSON.stringify(log)}`);
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
                        console.log(`Keeping log entry: ${line}`);
                        filteredLogs.push(line);
                    } else {
                        console.log(`Deleting log entry: ${line}`);
                        deletedCount++;
                    }
                } catch (error) {
                    console.error(`Error parsing log line in ${logPath}:`, error.message);
                }
            }

            if (filteredLogs.length < lines.length) {
                console.log(`Writing ${filteredLogs.length} remaining logs back to ${logPath}`);
                await fs.writeFile(logPath, filteredLogs.join('\n') + (filteredLogs.length ? '\n' : ''));
            } else {
                console.log(`No logs deleted in ${logPath}, no need to rewrite file`);
            }
        }

        console.log(`Total logs deleted from files: ${deletedCount}`);
        return deletedCount;
    } catch (error) {
        console.error('Error in deleteLogsFromFiles:', error.message);
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
        console.log('Starting getLogs with options:', { page, pageSize, level, route, service, status, method, userId, traceId, startDate, endDate, search, sortBy, sortOrder, includeDeleted });
        pageSize = Math.min(pageSize, config.maxPageSize);
        console.log(`Adjusted pageSize: ${pageSize}`);
        const offset = (page - 1) * pageSize;
        console.log(`Calculated offset: ${offset}`);

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
        console.log('Database query where clause:', where);

        console.log('Fetching logs from database');
        const { count, rows } = await this.Log.findAndCountAll({
            where,
            limit: pageSize,
            offset,
            order: [[sortBy, sortOrder]],
            paranoid: !includeDeleted, // Exclude soft-deleted logs unless includeDeleted is true
        });
        console.log(`Found ${count} total logs, retrieved ${rows.length} rows`);

        console.log('Decrypting sensitive metadata fields');
        const decryptedRows = rows.map(row => {
            const log = row.toJSON();
            console.log(`Processing log: ${JSON.stringify(log)}`);
            if (log.metadata) {
                Object.keys(log.metadata).forEach(key => {
                    if (log.metadata[`${key}Encrypted`]) {
                        console.log(`Decrypting metadata field: ${key}`);
                        const bytes = CryptoJS.AES.decrypt(log.metadata[key], config.encryptionKey);
                        log.metadata[key] = bytes.toString(CryptoJS.enc.Utf8);
                        console.log(`Decrypted ${key}: ${log.metadata[key]}`);
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
        console.log('Returning result:', result);
        return result;
    } catch (error) {
        console.error('Error in getLogs:', error.message);
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
            console.log('Starting getLogsByCategory with category:', category, 'and filters:', { startDate, endDate, level, route, service });
            const validCategories = ['level', 'route', 'service', 'status', 'method'];
            if (!validCategories.includes(category)) {
                console.error(`Invalid category provided: ${category}`);
                throw new Error(`Invalid category: ${category}`);
            }
            console.log('Category is valid:', category);

            const where = {};
            if (startDate || endDate) {
                where.timestamp = {};
                if (startDate) where.timestamp[Op.gte] = new Date(startDate);
                if (endDate) where.timestamp[Op.lte] = new Date(endDate);
            }
            if (level) where.level = level;
            if (route) where.route = route;
            if (service) where.service = service;
            console.log('Database query where clause:', where);

            console.log('Fetching grouped logs from database');
            const results = await this.Log.findAll({
                attributes: [
                    category,
                    [this.Log.sequelize.fn('COUNT', this.Log.sequelize.col(category)), 'count'],
                ],
                where,
                group: [category],
                order: [[this.Log.sequelize.literal('count'), 'desc']],
            });
            console.log(`Found ${results.length} grouped results`);

            const formattedResults = results.map(row => row.toJSON());
            console.log('Returning formatted results:', formattedResults);
            return formattedResults;
        } catch (error) {
            console.error('Error in getLogsByCategory:', error.message);
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
        console.log('Starting deleteLogs with filters:', { level, route, service, status, method, userId, traceId, startDate, endDate, force });
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
        console.log('Database delete where clause:', where);

        console.log('Deleting logs from database');
        const dbDeletedCount = await this.Log.destroy({ where, force });
        console.log(`Deleted ${dbDeletedCount} logs from database`);

        let fileDeletedCount = 0;
        if (!level && !route && !service && !status && !method && !userId && !traceId && !startDate && !endDate) {
            console.log('No filters provided, clearing all log files');
            for (const routeKey of Object.keys(routeLogDirs)) {
                const logPath = path.join(config.baseLogDir, routeLogDirs[routeKey], `${routeLogDirs[routeKey]}.log`);
                console.log(`Processing log file: ${logPath}`);
                if (await fs.access(logPath).then(() => true).catch(() => false)) {
                    console.log(`Reading log file: ${logPath}`);
                    const fileContent = await fs.readFile(logPath, 'utf8');
                    const lineCount = fileContent.split('\n').filter(line => line.trim()).length;
                    console.log(`Found ${lineCount} log lines in ${logPath}`);
                    fileDeletedCount += lineCount;
                    console.log(`Clearing log file: ${logPath}`);
                    await fs.writeFile(logPath, '');
                } else {
                    console.log(`Log file does not exist: ${logPath}, skipping`);
                }
            }
        } else {
            console.log('Deleting specific logs from files');
            fileDeletedCount = await this.deleteLogsFromFiles({ level, route, service, status, method, userId, traceId, startDate, endDate });
            console.log(`Deleted ${fileDeletedCount} logs from files`);
        }

        const result = { dbDeletedCount, fileDeletedCount };
        console.log('Returning result:', result);
        return result;
    } catch (error) {
        console.error('Error in deleteLogs:', error.message);
        throw error;
    }
}

async archiveLogs(retentionDays = config.archiveRetentionDays, force = false) {
    try {
        console.log(`Starting archiveLogs with retentionDays: ${retentionDays}, force: ${force}`);
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - retentionDays);
        console.log(`Threshold date for archiving: ${thresholdDate}`);

        console.log('Deleting old logs from database');
        const dbDeletedCount = await this.Log.destroy({
            where: {
                timestamp: { [Op.lte]: thresholdDate },
            },
            force,
        });
        console.log(`Archived ${dbDeletedCount} logs from database`);

        console.log('Archiving logs from files');
        let fileDeletedCount = 0;
        for (const routeKey of Object.keys(routeLogDirs)) {
            const logDir = path.join(config.baseLogDir, routeLogDirs[routeKey]);
            const logPath = path.join(logDir, `${routeLogDirs[routeKey]}.log`);
            console.log(`Processing log file: ${logPath}`);
            if (!(await fs.access(logPath).then(() => true).catch(() => false))) {
                console.log(`Log file does not exist: ${logPath}, skipping`);
                continue;
            }

            console.log(`Reading log file: ${logPath}`);
            const fileContent = await fs.readFile(logPath, 'utf8');
            const lines = fileContent.split('\n').filter(line => line.trim());
            console.log(`Found ${lines.length} log lines in ${logPath}`);
            const filteredLogs = [];

            for (const line of lines) {
                try {
                    const log = JSON.parse(line);
                    console.log(`Parsed log entry: ${JSON.stringify(log)}`);
                    if (new Date(log.timestamp) > thresholdDate) {
                        console.log(`Keeping log entry: ${line}`);
                        filteredLogs.push(line);
                    } else {
                        console.log(`Archiving log entry: ${line}`);
                        fileDeletedCount++;
                    }
                } catch (error) {
                    console.error(`Error parsing log line in ${logPath}:`, error.message);
                }
            }

            if (filteredLogs.length < lines.length) {
                console.log(`Writing ${filteredLogs.length} remaining logs back to ${logPath}`);
                await fs.writeFile(logPath, filteredLogs.join('\n') + (filteredLogs.length ? '\n' : ''));
            } else {
                console.log(`No logs archived in ${logPath}, no need to rewrite file`);
            }
        }

        const result = { dbDeletedCount, fileDeletedCount };
        console.log(`Returning archived counts: ${JSON.stringify(result)}`);
        return result;
    } catch (error) {
        console.error('Error in archiveLogs:', error.message);
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
        console.log('Starting getLogStatistics with options:', { startDate, endDate, route, service, level });
        const where = {};
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate) where.timestamp[Op.gte] = new Date(startDate);
            if (endDate) where.timestamp[Op.lte] = new Date(endDate);
        }
        if (route) where.route = route;
        if (service) where.service = service;
        if (level) where.level = level;
        console.log('Database query where clause:', where);

        console.log('Fetching database statistics');
        const [total, byLevel, byRoute, byService, byStatus, byMethod, uniqueUsers, trends] = await Promise.all([
            this.Log.count({ where }).then(count => {
                console.log(`Total database logs: ${count}`);
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
                console.log('Logs by level:', results);
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
                console.log('Logs by route:', results);
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
                console.log('Logs by service:', results);
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
                console.log('Logs by status:', results);
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
                console.log('Logs by method:', results);
                return results;
            }),
            this.Log.findAll({
                attributes: [[this.Log.sequelize.fn('DISTINCT', this.Log.sequelize.col('userId')), 'userId']],
                where: { ...where, userId: { [Op.ne]: null } },
                raw: true,
            }).then(results => {
                console.log(`Unique users: ${results.length}`);
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
                console.log('Trends:', results);
                return results;
            }),
        ]);

        console.log('Fetching archived logs statistics from files');
        const archivedStats = { total: 0, byRoute: {}, byLevel: {}, byService: {}, byStatus: {}, byMethod: {} };
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - config.archiveRetentionDays);
        console.log(`Threshold date for archived stats: ${thresholdDate}`);

        for (const routeKey of Object.keys(routeLogDirs)) {
            const logPath = path.join(config.baseLogDir, routeLogDirs[routeKey], `${routeLogDirs[routeKey]}.log`);
            console.log(`Processing archived log file: ${logPath}`);
            if (!(await fs.access(logPath).then(() => true).catch(() => false))) {
                console.log(`Log file does not exist: ${logPath}, skipping`);
                continue;
            }

            console.log(`Reading archived log file: ${logPath}`);
            const fileContent = await fs.readFile(logPath, 'utf8');
            const lines = fileContent.split('\n').filter(line => line.trim());
            console.log(`Found ${lines.length} log lines in ${logPath}`);

            for (const line of lines) {
                try {
                    const log = JSON.parse(line);
                    console.log(`Parsed archived log entry: ${JSON.stringify(log)}`);
                    if (new Date(log.timestamp) <= thresholdDate) {
                        console.log(`Counting archived log: ${line}`);
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
        console.log('Archived stats:', archivedStats);

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
        console.log('Returning result:', result);
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
            console.log('Starting exportLogs with filters:', { level, route, service, status, startDate, endDate });
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
            console.log('Database query where clause:', where);

            console.log('Fetching logs for export');
            const logs = await this.Log.findAll({ where });
            console.log(`Found ${logs.length} logs for export`);

            console.log('Decrypting logs for export');
            const decryptedLogs = logs.map(log => {
                const logData = log.toJSON();
                console.log(`Processing log for export: ${JSON.stringify(logData)}`);
                if (logData.metadata) {
                    Object.keys(logData.metadata).forEach(key => {
                        if (logData.metadata[`${key}Encrypted`]) {
                            console.log(`Decrypting metadata field: ${key}`);
                            const bytes = CryptoJS.AES.decrypt(logData.metadata[key], config.encryptionKey);
                            logData.metadata[key] = bytes.toString(CryptoJS.enc.Utf8);
                            console.log(`Decrypted ${key}: ${logData.metadata[key]}`);
                        }
                    });
                }
                return logData;
            });

            console.log(`Returning ${decryptedLogs.length} decrypted logs`);
            return decryptedLogs;
        } catch (error) {
            console.error('Error in exportLogs:', error.message);
            throw error;
        }
    }

    /**
     * Clear all logs from database and files
     * @returns {Promise<Object>} Number of deleted logs from database and files
     */
async clearAllLogs() {
    try {
        console.log('Starting clearAllLogs');
        console.log('Deleting all logs from database');
        const dbDeletedCount = await this.Log.destroy({ where: {}, truncate: true, force: true });
        console.log(`Deleted ${dbDeletedCount} logs from database`);

        let fileDeletedCount = 0;
        console.log('Clearing all log files');
        for (const routeKey of Object.keys(routeLogDirs)) {
            const logDir = path.join(config.baseLogDir, routeLogDirs[routeKey]);
            const logPath = path.join(logDir, `${routeLogDirs[routeKey]}.log`);
            console.log(`Processing log file: ${logPath}`);
            try {
                if (await fs.access(logPath).then(() => true).catch(() => false)) {
                    console.log(`Reading log file: ${logPath}`);
                    const fileContent = await fs.readFile(logPath, 'utf8');
                    const lineCount = fileContent.split('\n').filter(line => line.trim()).length;
                    console.log(`Found ${lineCount} log lines in ${logPath}`);
                    fileDeletedCount += lineCount;
                    console.log(`Clearing log file: ${logPath}`);
                    await fs.writeFile(logPath, '');
                } else {
                    console.log(`Log file does not exist: ${logPath}, skipping`);
                }
            } catch (error) {
                console.error(`Error processing log file ${logPath}: ${error.message}`);
            }
        }

        const result = { dbDeletedCount, fileDeletedCount };
        console.log('Returning result:', result);
        return result;
    } catch (error) {
        console.error('Error in clearAllLogs:', error.message);
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
            console.log(`Starting getUniqueValues for field: ${field}`);
            const validFields = ['level', 'route', 'service', 'status', 'method', 'userId'];
            if (!validFields.includes(field)) {
                console.error(`Invalid field provided: ${field}`);
                throw new Error(`Invalid field: ${field}`);
            }
            console.log('Field is valid:', field);

            console.log('Fetching unique values from database');
            const results = await this.Log.findAll({
                attributes: [[this.Log.sequelize.fn('DISTINCT', this.Log.sequelize.col(field)), field]],
                where: { [field]: { [Op.ne]: null } },
            });
            console.log(`Found ${results.length} unique values`);

            const uniqueValues = results.map(row => row[field]);
            console.log('Returning unique values:', uniqueValues);
            return uniqueValues;
        } catch (error) {
            console.error('Error in getUniqueValues:', error.message);
            throw error;
        }
    }
}

module.exports = SystemService;