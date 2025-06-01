const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');
const {
    Visit, Role, Timesheet, ReceiptBook, ReceiptStub, User, Log, Agent, Region,
    Delegation, Governorate, ReceiptBookType, Reason, Checklist, VisitChecklist
} = require('../models');
const { Op, Sequelize } = require('sequelize');
const logger = require('../utils/logger');

class ReportService {
    // Helper to validate filters
    static validateFilters(filters, allowedFilters) {
        const validated = {};
        for (const [key, value] of Object.entries(filters)) {
            if (allowedFilters.includes(key) && value !== undefined && value !== null) {
                validated[key] = value;
            }
        }
        return validated;
    }








    static async generateVisitSummaryReport(filters) {
        const allowedFilters = [
            'supervisorID', 'dateRange', 'regionID', 'agentID', 'status', 'visitReasons',
            'checklistCompleted', 'visitDuration', 'governorateID', 'delegationID',
            'visitType', 'aiAnomalies', 'dayOfWeek'
        ];
        const {
            supervisorID, dateRange, regionID, agentID, status = [], visitReasons = [],
            checklistCompleted, visitDuration, governorateID, delegationID, visitType,
            aiAnomalies, dayOfWeek
        } = ReportService.validateFilters(filters, allowedFilters);

        const where = {};
        const userWhere = {};
        const agentWhere = {};
        const delegationWhere = {};
        const governorateWhere = {};

        if (dateRange) {
            if (!dateRange.start || !dateRange.end) {
                throw new Error('Invalid date range: both start and end dates are required');
            }
            where.date = { [Op.between]: [new Date(dateRange.start), new Date(dateRange.end)] };
        }
        if (agentID) where.agentID = agentID;
        if (status.length) where.status = { [Op.in]: status };
        if (supervisorID) userWhere.userID = supervisorID;
        if (regionID) governorateWhere.regionID = regionID;
        if (governorateID) delegationWhere.governorateID = governorateID;
        if (delegationID) agentWhere.delegationID = delegationID;
        if (visitDuration) where.duration = { [Op.between]: visitDuration };
        if (visitType) where.agentID = visitType === 'recrutementVisits' ? null : { [Op.ne]: null };

        try {
            const visits = await Visit.findAll({
                where,
                include: [
                    {
                        model: Agent,
                        where: agentWhere,
                        required: false,
                        include: [{
                            model: Delegation,
                            where: delegationWhere,
                            required: !!delegationID,
                            include: [{
                                model: Governorate,
                                where: governorateWhere,
                                required: !!governorateID || !!regionID,
                                include: [{
                                    model: Region,
                                    required: !!regionID
                                }]
                            }]
                        }]
                    },
                    {
                        model: Timesheet,
                        include: [{
                            model: User,
                            where: userWhere,
                            required: true
                        }],
                        required: true
                    },
                    { model: Reason, through: { attributes: [] } },
                    {
                        model: Checklist,
                        through: { model: VisitChecklist, attributes: ['checked'] }
                    }
                ]
            });

            let filteredVisits = visits;
            if (visitReasons.length) {
                filteredVisits = filteredVisits.filter(v =>
                    v.Reasons.some(r => visitReasons.includes(r.item))
                );
            }
            if (checklistCompleted !== undefined) {
                filteredVisits = filteredVisits.filter(v => {
                    const completed = v.Checklists.every(c => c.VisitChecklist?.checked === true);
                    return checklistCompleted ? completed : !completed;
                });
            }
            if (aiAnomalies) {
                const anomalyLogs = await Log.findAll({
                    where: {
                        level: ['warn', 'error'],
                        route: { [Op.iLike]: '%visit%' }
                    }
                });
                const anomalyVisitIds = anomalyLogs.map(log => log.metadata?.visitID).filter(id => id);
                filteredVisits = filteredVisits.filter(v => anomalyVisitIds.includes(v.visitID));
            }

            const totalVisits = filteredVisits.length;
            const validatedVisits = filteredVisits.filter(v => v.status === 'validated').length;
            const pendingVisits = filteredVisits.filter(v => v.status === 'pending').length;
            const visitedVisits = filteredVisits.filter(v => v.status === 'visited').length;
            const rejectedVisits = filteredVisits.filter(v => v.status === 'rejected').length;
            const averageDuration = totalVisits > 0
                ? filteredVisits.reduce((sum, v) => sum + (v.duration || 0), 0) / totalVisits / 60
                : 0;

            return {
                summary: {
                    totalVisits,
                    validatedVisits,
                    pendingVisits,
                    visitedVisits,
                    rejectedVisits,
                    averageDuration: averageDuration.toFixed(2)
                },
                details: filteredVisits.map(v => ({
                    id: v.visitID,
                    date: v.date instanceof Date && !isNaN(v.date) ? v.date.toISOString().split('T')[0] : 'N/A',
                    location: v.location || 'N/A',
                    status: v.status || 'N/A',
                    agent: v.Agent ? `${v.Agent.name} ${v.Agent.lastname}` : 'No Agent',
                    supervisor: v.Timesheet?.User ? `${v.Timesheet.User.firstname} ${v.Timesheet.User.lastname}` : 'N/A',
                    region: v.Agent?.Delegation?.Governorate?.Region?.name || 'N/A',
                    reasons: v.Reasons.map(r => r.item).join(', ') || 'N/A',
                    checklistCompleted: v.Checklists.every(c => c.VisitChecklist?.checked === true)
                }))
            };
        } catch (error) {
            logger.error(`Failed to generate VisitSummary report: ${error.message}`, {
                route: 'reports', service: 'api', metadata: { filters }
            });
            throw new Error(`Failed to generate VisitSummary report: ${error.message}`);
        }
    }

    static async generateTimesheetReport(filters) {
        const allowedFilters = [
            'supervisorID', 'regionalManagerID', 'directorID', 'dateRange', 'status', 'numberOfVisits',
            'totalHours', 'aiSuggestions', 'anomaliesDetected', 'visitStatus', 'weekNumber',
            'directorName', 'checklistCompleted'];
        const {
            supervisorID, regionalManagerID, directorID, dateRange, status = [], numberOfVisits,
            totalHours, aiSuggestions, anomaliesDetected, visitStatus = [], weekNumber, checklistCompleted
        } = ReportService.validateFilters(filters, allowedFilters);

        const where = {};
        const userWhere = {};
        if (supervisorID) where.supervisorID = supervisorID;
        if (regionalManagerID) userWhere.regionalManagerID = regionalManagerID;
        if (directorID) userWhere.directorID = directorID;

        if (dateRange) {
            if (!dateRange.start || !dateRange.end) {
                throw new Error('Invalid date range: both start and end dates are required');
            }
            where.createdAt = { [Op.between]: [new Date(dateRange.start), new Date(dateRange.end)] };
        }
        if (status.length) where.status = { [Op.in]: status };
        if (weekNumber) where.weekNumber = weekNumber;


        try {
            const timesheets = await Timesheet.findAll({
                where,
                include: [
                    {
                        model: User,
                        where: userWhere,
                        required: true
                    },
                    {
                        model: Visit,
                        where: visitStatus.length ? { status: { [Op.in]: visitStatus } } : {},
                        required: false,
                        include: [
                            { model: Agent },
                            { model: Reason, through: { attributes: [] } },
                            { model: Checklist, through: { model: VisitChecklist, attributes: ['checked'] } }
                        ]
                    }
                ]
            });

            let filteredTimesheets = timesheets;
            if (numberOfVisits) filteredTimesheets = filteredTimesheets.filter(t => t.Visits.length >= numberOfVisits[0] && t.Visits.length <= numberOfVisits[1]);
            if (totalHours) {
                filteredTimesheets = filteredTimesheets.filter(t => {
                    const hours = t.Visits.reduce((sum, v) => sum + (v.duration || 0), 0) / 60;
                    return hours >= totalHours[0] && hours <= totalHours[1];
                });
            }
            if (visitStatus.length) filteredTimesheets = filteredTimesheets.filter(t => t.Visits.every(v => visitStatus.includes(v.status)));
            if (checklistCompleted !== undefined) {
                filteredTimesheets = filteredTimesheets.filter(t => {
                    const completed = t.Visits.every(v => v.Checklists.every(c => c.VisitChecklist?.checked === true));
                    return checklistCompleted ? completed : !completed;
                });
            }
            if (aiSuggestions) {
                const aiLogs = await Log.findAll({ where: { route: { [Op.iLike]: '%timesheet%' }, message: { [Op.iLike]: '%suggestion%' } } });
                const suggestionIds = aiLogs.map(log => log.metadata?.timesheetID).filter(id => id);
                filteredTimesheets = filteredTimesheets.filter(t => suggestionIds.includes(t.timesheetID));
            }
            if (anomaliesDetected) {
                const anomalyLogs = await Log.findAll({ where: { level: ['warn', 'error'], route: { [Op.iLike]: '%timesheet%' } } });
                const anomalyIds = anomalyLogs.map(log => log.metadata?.timesheetID).filter(id => id);
                filteredTimesheets = filteredTimesheets.filter(t => anomalyIds.includes(t.timesheetID));
            }

            return {
                summary: {
                    totalTimesheets: filteredTimesheets.length,
                    totalHours: filteredTimesheets.reduce((sum, t) => sum + t.Visits.reduce((s, v) => s + (v.duration || 0), 0), 0) / 60,
                    validatedTimesheets: filteredTimesheets.filter(t => t.status === 'validated').length,
                    pendingTimesheets: filteredTimesheets.filter(t => t.status === 'pending').length,
                    rejectedTimesheets: filteredTimesheets.filter(t => t.status === 'rejected').length
                },
                details: filteredTimesheets.map(t => ({
                    id: t.timesheetID,
                    supervisor: t.User ? `${t.User.firstname} ${t.User.lastname}` : 'N/A',
                    week: `${t.weekNumber}/${t.year}`,
                    status: t.status || 'N/A',
                    totalHours: (t.Visits.reduce((sum, v) => sum + (v.duration || 0), 0) / 60).toFixed(2),
                    visitReasons: t.Visits.map(v => v.Reasons?.map(r => r.item).join(', ') || 'N/A').join('; '),
                    numberOfVisits: t.Visits.length,
                    checklistCompleted: t.Visits.every(v => v.Checklists.every(c => c.VisitChecklist?.checked === true))
                }))
            };
        } catch (error) {
            logger.error(`Failed to generate Timesheet report: ${error.message}`, {
                route: 'reports', service: 'api', metadata: { filters }
            });
            throw new Error(`Failed to generate Timesheet report: ${error.message}`);
        }
    }

    static async generateReceiptBookInventoryReport(filters) {
        const allowedFilters = [
            'dateRange', 'regionID', 'bookType', 'status', 'agentID', 'governorateID', 'delegationID',
            'currentHolderName', 'agentName', 'assignmentStatus'
        ];
        const {
            dateRange, regionID, bookType, status = [], governorateID, delegationID,
            currentHolderName, agentName, assignmentStatus
        } = ReportService.validateFilters(filters, allowedFilters);

        const where = {};
        const agentWhere = {};
        const userWhere = {};
        const delegationWhere = {};
        const governorateWhere = {};

        if (dateRange) {
            if (!dateRange.start || !dateRange.end) {
                throw new Error('Invalid date range: both start and end dates are required');
            }
            const visitsInRange = await Visit.findAll({
                where: {
                    date: { [Op.between]: [new Date(dateRange.start), new Date(dateRange.end)] }
                },
                attributes: ['timesheetID']
            });
            const timesheetIDs = [...new Set(visitsInRange.map(v => v.timesheetID).filter(id => id))];
            if (timesheetIDs.length === 0) {
                where.timesheetID = null;
            } else {
                where.timesheetID = { [Op.in]: timesheetIDs };
            }
        }
        if (regionID) governorateWhere.regionID = regionID;
        if (governorateID) delegationWhere.governorateID = governorateID;
        if (delegationID) agentWhere.delegationID = delegationID;
        if (bookType) where.typeID = bookType;
        if (status.length) where.status = { [Op.in]: status };
        if (currentHolderName) userWhere[Op.or] = [
            { firstname: { [Op.iLike]: `%${currentHolderName}%` } },
            { lastname: { [Op.iLike]: `%${currentHolderName}%` } }
        ];
        if (agentName) agentWhere[Op.or] = [
            { name: { [Op.iLike]: `%${agentName}%` } },
            { lastname: { [Op.iLike]: `%${agentName}%` } }
        ];
        if (assignmentStatus) where.agentID = assignmentStatus === 'assigned' ? { [Op.ne]: null } : null;

        try {
            const receiptBooks = await ReceiptBook.findAll({
                where,
                include: [
                    {
                        model: Agent,
                        where: agentWhere,
                        required: false,
                        include: [{
                            model: Delegation,
                            where: delegationWhere,
                            required: !!delegationID,
                            include: [{
                                model: Governorate,
                                where: governorateWhere,
                                required: !!governorateID || !!regionID,
                                include: [{ model: Region, required: !!regionID }]
                            }]
                        }]
                    },
                    { model: ReceiptBookType, required: false },
                    {
                        model: User,
                        as: 'CurrentHolder',
                        where: userWhere,
                        required: false
                    }
                ]
            });

            return {
                summary: {
                    totalBooks: receiptBooks.length,
                    inStock: receiptBooks.filter(b => b.status === 'In Stock').length,
                    withAgents: receiptBooks.filter(b => b.status === 'Assigned to Agent').length,
                    withSupervisors: receiptBooks.filter(b => b.status === 'With Supervisor').length,
                    archived: receiptBooks.filter(b => b.status === 'Archived').length
                },
                details: receiptBooks.map(b => ({
                    id: b.bookID,
                    number: b.number || 'N/A',
                    status: b.status || 'N/A',
                    type: b.ReceiptBookType?.name || 'N/A',
                    region: b.Agent?.Delegation?.Governorate?.Region?.name || 'N/A',
                    currentHolder: b.CurrentHolder
                        ? `${b.CurrentHolder.firstname} ${b.CurrentHolder.lastname}`
                        : b.Agent
                            ? `${b.Agent.name} ${b.Agent.lastname}`
                            : 'N/A',
                    assignedToAgent: !!b.agentID
                }))
            };
        } catch (error) {
            logger.error(`Failed to generate ReceiptBookInventory report: ${error.message}`, {
                route: 'reports', service: 'api', metadata: { filters }
            });
            throw new Error(`Failed to generate ReceiptBookInventory report: ${error.message}`);
        }
    }

    static async generateStubCollectionReport(filters) {
        const allowedFilters = [
            'agentID', 'supervisorID', 'regionalManagerID', 'dateRange', 'status',
            'agentName', 'currentHolderName'
        ];
        const {
            agentID, supervisorID, regionalManagerID, dateRange, status = [],
            agentName, currentHolderName
        } = ReportService.validateFilters(filters, allowedFilters);

        const where = {};
        const bookWhere = {};
        const userWhere = {};
        const agentWhere = {};

        if (agentID) bookWhere.agentID = agentID;
        if (supervisorID) bookWhere.currentHolderID = supervisorID;
        if (regionalManagerID) userWhere.regionalManagerID = regionalManagerID;
        if (dateRange) {
            if (!dateRange.start || !dateRange.end) {
                throw new Error('Invalid date range: both start and end dates are required');
            }
            where.updatedAt = { [Op.between]: [new Date(dateRange.start), new Date(dateRange.end)] };
        }
        if (status.length) where.status = { [Op.in]: status };
        if (agentName) agentWhere[Op.or] = [
            { name: { [Op.iLike]: `%${agentName}%` } },
            { lastname: { [Op.iLike]: `%${agentName}%` } }
        ];
        if (currentHolderName) userWhere[Op.or] = [
            { firstname: { [Op.iLike]: `%${currentHolderName}%` } },
            { lastname: { [Op.iLike]: `%${currentHolderName}%` } }
        ];

        try {
            const stubs = await ReceiptStub.findAll({
                where,
                include: [
                    {
                        model: ReceiptBook,
                        where: bookWhere,
                        include: [
                            { model: User, as: 'CurrentHolder', where: userWhere, required: false },
                            {
                                model: Agent,
                                where: agentWhere,
                                required: false,
                                include: [{
                                    model: Delegation,
                                    include: [{ model: Governorate, include: [{ model: Region }] }]
                                }]
                            }
                        ]
                    }
                ]
            });

            return {
                summary: {
                    totalStubs: stubs.length,
                    collected: stubs.filter(s => s.status === 'collected').length,
                    transmitted: stubs.filter(s => s.status === 'transmitted').length,
                    archived: stubs.filter(s => s.status === 'archived').length,
                    pending: stubs.filter(s => s.status === 'pending').length
                },
                details: stubs.map(s => ({
                    id: s.stubID,
                    stubNumber: s.number || 'N/A',
                    bookNumber: s.ReceiptBook?.number || 'N/A',
                    status: s.status || 'N/A',
                    agent: s.ReceiptBook?.Agent
                        ? `${s.ReceiptBook.Agent.name} ${s.ReceiptBook.Agent.lastname}`
                        : 'N/A',
                    currentHolder: s.ReceiptBook?.CurrentHolder
                        ? `${s.ReceiptBook.CurrentHolder.firstname} ${s.ReceiptBook.CurrentHolder.lastname}`
                        : 'N/A',
                    region: s.ReceiptBook?.Agent?.Delegation?.Governorate?.Region?.name || 'N/A'
                }))
            };
        } catch (error) {
            logger.error(`Failed to generate StubCollection report: ${error.message}`, {
                route: 'reports', service: 'api', metadata: { filters }
            });
            throw new Error(`Failed to generate StubCollection report: ${error.message}`);
        }
    }

    static async generateUserActivityReport(filters) {
        const allowedFilters = [
            'roleID', 'dateRange', 'activityType', 'userID', 'status',
            'suspiciousActivity', 'ipAddress'
        ];
        const {
            roleID, dateRange, activityType, userID, status, suspiciousActivity,
            ipAddress
        } = ReportService.validateFilters(filters, allowedFilters);

        const where = {};
        const roleWhere = {};
        const userWhere = {};
        if (dateRange) {
            if (!dateRange.start || !dateRange.end) {
                throw new Error('Invalid date range: both start and end dates are required');
            }
            where.timestamp = { [Op.between]: [new Date(dateRange.start), new Date(dateRange.end)] };
        }
        if (activityType) where.route = { [Op.iLike]: `%${activityType}%` };
        if (userID) where.userId = userID;
        if (status) where.status = status;
        if (ipAddress) where.ip = { [Op.iLike]: `%${ipAddress}%` };
        if (roleID) roleWhere.roleID = roleID;

        try {
            const logs = await Log.findAll({ where });
            const userIds = [...new Set(logs.map(l => l.userId).filter(id => id))];
            const users = await User.findAll({
                where: { userID: { [Op.in]: userIds }, ...userWhere },
                include: [{
                    model: Role,
                    where: roleWhere,
                    required: !!roleID,
                    through: { attributes: [] }
                }]
            });

            const userMap = users.reduce((map, user) => {
                map[user.userID] = {
                    firstname: user.firstname,
                    lastname: user.lastname,
                    role: user.Roles?.[0]?.name || 'N/A'
                };
                return map;
            }, {});

            let filteredLogs = logs;
            if (suspiciousActivity) {
                filteredLogs = filteredLogs.filter(l => ['warn', 'error'].includes(l.level));
            }

            return {
                summary: {
                    totalActivities: filteredLogs.length,
                    uniqueUsers: [...new Set(filteredLogs.map(l => l.userId).filter(id => id))].length,
                    suspiciousActivities: filteredLogs.filter(l => ['warn', 'error'].includes(l.level)).length,
                    lastActivity: filteredLogs.length
                        ? new Date(Math.max(...filteredLogs.map(l => new Date(l.timestamp).getTime()))).toISOString()
                        : 'N/A'
                },
                details: filteredLogs.map(l => ({
                    id: l.logID,
                    user: l.userId && userMap[l.userId]
                        ? `${userMap[l.userId].firstname} ${userMap[l.userId].lastname}`
                        : 'N/A',
                    role: l.userId && userMap[l.userId] ? userMap[l.userId].role : 'N/A',
                    activity: l.route,
                    timestamp: l.timestamp ? l.timestamp.toISOString() : 'N/A',
                    status: l.status || 'N/A',
                    suspicious: ['warn', 'error'].includes(l.level) ? 'Yes' : 'No',
                    ipAddress: l.ip || 'N/A',
                }))
            };
        } catch (error) {
            logger.error(`Failed to generate UserActivity report: ${error.message}`, {
                route: 'reports', service: 'api', metadata: { filters }
            });
            throw new Error(`Failed to generate UserActivity report: ${error.message}`);
        }
    }

    static async generateAIAnomalyReport(filters) {
        const allowedFilters = [
            'dateRange', 'roleID', 'userID', 'affectedEntity',
            'severity', 'route'
        ];
        const {
            dateRange, roleID, userID, affectedEntity, severity = ['warn', 'error'], route
        } = ReportService.validateFilters(filters, allowedFilters);

        const where = { level: { [Op.in]: severity } };
        const roleWhere = {};
        const userWhere = {};
        if (dateRange) {
            if (!dateRange.start || !dateRange.end) {
                throw new Error('Invalid date range: both start and end dates are required');
            }
            where.timestamp = { [Op.between]: [new Date(dateRange.start), new Date(dateRange.end)] };
        }
        if (userID) where.userId = userID;
        if (route) where.route = { [Op.iLike]: `%${route}%` };
        if (roleID) roleWhere.roleID = roleID;
        if (affectedEntity) where.route = { [Op.iLike]: `%${affectedEntity}%` };

        try {
            const logs = await Log.findAll({ where });
            const userIds = [...new Set(logs.map(l => l.userId).filter(id => id))];
            const users = await User.findAll({
                where: { userID: { [Op.in]: userIds }, ...userWhere },
                include: [{
                    model: Role,
                    where: roleWhere,
                    required: !!roleID,
                    through: { attributes: [] }
                }]
            });

            const userMap = users.reduce((map, user) => {
                map[user.userID] = {
                    firstname: user.firstname,
                    lastname: user.lastname,
                    role: user.Roles?.[0]?.name || 'N/A'
                };
                return map;
            }, {});

            return {
                summary: {
                    totalAnomalies: logs.length,
                    warningAnomalies: logs.filter(l => l.level === 'warn').length,
                    errorAnomalies: logs.filter(l => l.level === 'error').length,
                    uniqueUsers: userIds.length
                },
                details: logs.map(l => ({
                    id: l.logID,
                    user: l.userId && userMap[l.userId]
                        ? `${userMap[l.userId].firstname} ${userMap[l.userId].lastname}`
                        : 'N/A',
                    role: l.userId && userMap[l.userId] ? userMap[l.userId].role : 'N/A',
                    anomaly: l.message || 'N/A',
                    affected: l.route.includes('timesheet') ? 'Timesheet'
                        : l.route.includes('visit') ? 'Visit'
                            : l.route.includes('receipt') ? 'Receipt'
                                : 'Other',
                    severity: l.level,
                    timestamp: l.timestamp ? l.timestamp.toISOString() : 'N/A',
                    route: l.route || 'N/A'
                }))
            };
        } catch (error) {
            logger.error(`Failed to generate AIAnomaly report: ${error.message}`, {
                route: 'reports', service: 'api', metadata: { filters }
            });
            throw new Error(`Failed to generate AIAnomaly report: ${error.message}`);
        }
    }

    static async generateAgentPerformanceReport(filters) {
        const allowedFilters = [
            'supervisorID', 'regionalManagerID', 'dateRange', 'agentID', 'performanceScore',
            'numberOfVisits', 'stubsCollected', 'receiptBooksAssigned', 'regionID', 'governorateID',
            'delegationID', 'visitCompletionRate',
            'locationUpdated'
        ];
        const {
            supervisorID, regionalManagerID, dateRange, agentID, performanceScore,
            numberOfVisits, stubsCollected, receiptBooksAssigned, regionID, governorateID,
            delegationID, visitCompletionRate,
            locationUpdated
        } = ReportService.validateFilters(filters, allowedFilters);

        const where = {};
        const visitWhere = {};
        const delegationWhere = {};
        const governorateWhere = {};
        const regionWhere = {};

        if (supervisorID) where.supervisorID = supervisorID;
        if (regionalManagerID) regionWhere.regionalManagerID = regionalManagerID;
        if (dateRange) {
            if (!dateRange.start || !dateRange.end) {
                throw new Error('Invalid date range: both start and end dates are required');
            }
            visitWhere.date = { [Op.between]: [new Date(dateRange.start), new Date(dateRange.end)] };
        }
        if (agentID) where.agentID = agentID;
        if (regionID) governorateWhere.regionID = regionID;
        if (governorateID) delegationWhere.governorateID = governorateID;
        if (delegationID) delegationWhere.delegationID = delegationID;

        try {
            const agents = await Agent.findAll({
                where,
                include: [
                    { model: Visit, where: visitWhere, required: false },
                    { model: ReceiptBook, include: [{ model: ReceiptStub, required: false }], required: false },
                    {
                        model: Delegation,
                        where: delegationWhere,
                        include: [{
                            model: Governorate,
                            where: governorateWhere,
                            required: !!governorateID || !!regionID,
                            include: [{ model: Region, where: regionWhere, required: !!regionID || !!regionalManagerID }]
                        }],
                        required: !!delegationID
                    },
                    { model: User, as: 'Supervisor' }
                ]
            });

            let filteredAgents = agents;
            if (numberOfVisits) filteredAgents = filteredAgents.filter(a => a.Visits.length >= numberOfVisits[0] && a.Visits.length <= numberOfVisits[1]);
            if (stubsCollected) filteredAgents = filteredAgents.filter(a => {
                const collected = a.ReceiptBooks.reduce((sum, b) => sum + (b.ReceiptStubs?.filter(s => s?.status === 'collected').length || 0), 0);
                return collected >= stubsCollected[0] && collected <= stubsCollected[1];
            });
            if (receiptBooksAssigned) filteredAgents = filteredAgents.filter(a => a.ReceiptBooks.length >= receiptBooksAssigned[0] && a.ReceiptBooks.length <= receiptBooksAssigned[1]);
            if (visitCompletionRate) {
                filteredAgents = filteredAgents.filter(a => {
                    const rate = a.Visits.length ? (a.Visits.filter(v => v.status === 'completed').length / a.Visits.length) * 100 : 0;
                    return rate >= visitCompletionRate[0] && rate <= visitCompletionRate[1];
                });
            }
            if (performanceScore) {
                filteredAgents = filteredAgents.filter(a => {
                    const score = a.Visits.length ? (a.Visits.filter(v => v.status === 'completed').length / a.Visits.length) * 100 : 0;
                    return score >= performanceScore[0] && score <= performanceScore[1];
                });
            }
            if (locationUpdated !== undefined) filteredAgents = filteredAgents.filter(a => (a.latitude && a.longitude) === locationUpdated);

            return {
                summary: {
                    totalAgents: filteredAgents.length,
                    totalVisits: filteredAgents.reduce((sum, a) => sum + a.Visits.length, 0),
                    totalStubsCollected: filteredAgents.reduce((sum, a) => sum + (a.ReceiptBooks?.reduce((s, b) => s + (b.ReceiptStubs?.filter(st => st?.status === 'collected').length || 0), 0) || 0), 0),
                    totalReceiptBooksAssigned: filteredAgents.reduce((sum, a) => sum + a.ReceiptBooks.length, 0),
                    averagePerformanceScore: filteredAgents.length
                        ? (filteredAgents.reduce((sum, a) => {
                            const score = a.Visits.length ? (a.Visits.filter(v => v.status === 'completed').length / a.Visits.length) * 100 : 0;
                            return sum + score;
                        }, 0) / filteredAgents.length).toFixed(1)
                        : '0.0'
                },
                details: filteredAgents.map(a => ({
                    id: a.agentID,
                    name: `${a.name || 'N/A'} ${a.lastname || ''}`,
                    visitsReceived: a.Visits.length,
                    completedVisits: a.Visits.filter(v => v.status === 'completed').length,
                    stubsCollected: a.ReceiptBooks.reduce((sum, b) => sum + (b.ReceiptStubs?.filter(s => s?.status === 'collected').length || 0), 0),
                    receiptBooksAssigned: a.ReceiptBooks.length,
                    region: a.Delegation?.Governorate?.Region?.name || 'N/A',
                    supervisor: a.Supervisor ? `${a.Supervisor.firstname} ${a.Supervisor.lastname}` : 'N/A',
                    performanceScore: a.Visits.length ? ((a.Visits.filter(v => v.status === 'completed').length / a.Visits.length) * 100).toFixed(1) : '0.0',
                    locationUpdated: !!(a.latitude && a.longitude)
                }))
            };
        } catch (error) {
            logger.error(`Failed to generate AgentPerformance report: ${error.message}`, {
                route: 'reports', service: 'api', metadata: { filters }
            });
            throw new Error(`Failed to generate AgentPerformance report: ${error.message}`);
        }
    }

    static async generateRegionPerformance(filters) {
        const allowedFilters = [
            'regionalManagerID', 'dateRange', 'regionID', 'governorateID', 'delegationID',
            'performanceScore', 'numberOfVisits', 'stubsCollected'
        ];
        const {
            regionalManagerID, dateRange, regionID, governorateID, delegationID,
            performanceScore, numberOfVisits, stubsCollected
        } = ReportService.validateFilters(filters, allowedFilters);

        const where = {};
        const visitWhere = {};
        const governorateWhere = {};
        const delegationWhere = {};
        if (regionalManagerID) where.regionalManagerID = regionalManagerID;
        if (dateRange) {
            if (!dateRange.start || !dateRange.end) {
                throw new Error('Invalid date range: both start and end are required');
            }
            visitWhere.date = { [Op.between]: [new Date(dateRange.start), new Date(dateRange.end)] };
        }
        if (regionID) where.regionID = regionID;
        if (governorateID) governorateWhere.governorateID = governorateID;
        if (delegationID) delegationWhere.delegationID = delegationID;

        try {
            const regions = await Region.findAll({
                where,
                include: [
                    {
                        model: Governorate,
                        where: governorateWhere,
                        required: !!governorateID,
                        include: [
                            {
                                model: Delegation,
                                where: delegationWhere,
                                required: !!delegationID,
                                include: [
                                    {
                                        model: Agent,
                                        include: [
                                            { model: Visit, where: visitWhere, required: false },
                                            { model: ReceiptBook, include: [{ model: ReceiptStub, required: false }], required: false }
                                        ],
                                        required: false
                                    }
                                ]
                            }
                        ]
                    }
                ]
            });

            let filteredRegions = regions;
            if (numberOfVisits) {
                filteredRegions = filteredRegions.filter(r => {
                    const visits = r.Governorates.reduce((sum, g) =>
                        sum + g.Delegations.reduce((s, d) => s + (d.Agent?.Visits?.length || 0), 0), 0);
                    return visits >= numberOfVisits[0] && visits <= numberOfVisits[1];
                });
            }
            if (stubsCollected) {
                filteredRegions = filteredRegions.filter(r => {
                    const stubs = r.Governorates.reduce((sum, g) =>
                        sum + g.Delegations.reduce((s, d) =>
                            s + (d.Agent?.ReceiptBooks?.reduce((t, b) =>
                                t + (b.ReceiptStubs?.filter(st => st?.status === 'collected').length || 0), 0) || 0), 0), 0);
                    return stubs >= stubsCollected[0] && stubs <= stubsCollected[1];
                });
            }
            if (performanceScore) {
                filteredRegions = filteredRegions.filter(r => {
                    const totalVisits = r.Governorates.reduce((sum, g) =>
                        sum + g.Delegations.reduce((s, d) => s + (d.Agent?.Visits?.length || 0), 0), 0);
                    const completedVisits = r.Governorates.reduce((sum, g) =>
                        sum + g.Delegations.reduce((s, d) =>
                            s + (d.Agent?.Visits?.filter(v => v.status === 'completed').length || 0), 0), 0);
                    const score = totalVisits ? (completedVisits / totalVisits) * 100 : 0;
                    return score >= performanceScore[0] && score <= performanceScore[1];
                });
            }

            return {
                summary: {
                    totalRegions: filteredRegions.length,
                    totalVisits: filteredRegions.reduce((sum, r) =>
                        sum + r.Governorates.reduce((a, g) =>
                            a + g.Delegations.reduce((s, d) => s + (d.Agent?.Visits?.length || 0), 0), 0), 0),
                    totalStubsCollected: filteredRegions.reduce((sum, r) =>
                        sum + r.Governorates.reduce((a, g) =>
                            a + g.Delegations.reduce((s, d) =>
                                s + (d.Agent?.ReceiptBooks?.reduce((t, b) =>
                                    t + (b.ReceiptStubs?.filter(st => st?.status === 'collected').length || 0), 0) || 0), 0), 0), 0),
                    averagePerformanceScore: filteredRegions.length
                        ? (filteredRegions.reduce((sum, r) => {
                            const totalVisits = r.Governorates.reduce((sum, g) =>
                                sum + g.Delegations.reduce((s, d) => s + (d.Agent?.Visits?.length || 0), 0), 0);
                            const completedVisits = r.Governorates.reduce((sum, g) =>
                                sum + g.Delegations.reduce((s, d) =>
                                    s + (d.Agent?.Visits?.filter(v => v.status === 'completed').length || 0), 0), 0);
                            return sum + (totalVisits ? (completedVisits / totalVisits) * 100 : 0);
                        }, 0) / filteredRegions.length).toFixed(1)
                        : '0.0'
                },
                details: await Promise.all(filteredRegions.map(async r => {
                    let regionalManagerName = 'N/A';
                    if (r.regionalManagerID) {
                        const user = await User.findByPk(r.regionalManagerID);
                        if (user) {
                            regionalManagerName = `${user.firstname} ${user.lastname}`;
                        }
                    }
                    return {
                        id: r.regionID,
                        name: r.name || 'N/A',
                        visits: r.Governorates.reduce((sum, g) =>
                            sum + g.Delegations.reduce((s, d) => s + (d.Agent?.Visits?.length || 0), 0), 0),
                        visitsCompleted: r.Governorates.reduce((sum, g) =>
                            sum + g.Delegations.reduce((s, d) =>
                                s + (d.Agent?.Visits?.filter(v => v.status === 'completed').length || 0), 0), 0),
                        stubsCollected: r.Governorates.reduce((sum, g) =>
                            sum + g.Delegations.reduce((s, d) =>
                                s + (d.Agent?.ReceiptBooks?.reduce((t, b) =>
                                    t + (b.ReceiptStubs?.filter(st => st?.status === 'collected').length || 0), 0) || 0), 0), 0),
                        performanceScore: ((r.Governorates.reduce((sum, g) =>
                            sum + g.Delegations.reduce((s, d) =>
                                s + (d.Agent?.Visits?.filter(v => v.status === 'completed').length || 0), 0), 0) /
                            (r.Governorates.reduce((sum, g) =>
                                sum + g.Delegations.reduce((s, d) => s + (d.Agent?.Visits?.length || 0), 0), 0) || 1)) *
                            100).toFixed(1) || '0.0',
                        regionalManager: regionalManagerName
                    };
                }))
            };
        } catch (error) {
            logger.error(`Failed to generate RegionPerformance report: ${error.message}`, {
                route: 'reports', service: 'api', metadata: { filters }
            });
            throw new Error(`Failed to generate RegionPerformance report: ${error.message}`);
        }
    }

    static async generateFullReport(filters) {
        const allowedFilters = [
            'supervisorID', 'regionalManagerID', 'dateRange', 'regionID', 'agentID', 'status',
            'visitReasons'
        ];
        const {
            supervisorID, regionalManagerID, dateRange, regionID, agentID, status,
            visitReasons,
        } = ReportService.validateFilters(filters, allowedFilters);

        if (!supervisorID && !regionalManagerID) {
            throw new Error('Either supervisorID or regionalManagerID is required');
        }

        try {
            const [
                visitSummaryReport,
                timesheetReport,
                receiptBookInventoryReport,
                stubCollectionReport,
                userActivityReport,
                aiAnomalyReport,
                agentPerformanceReport,
                regionPerformanceReport
            ] = await Promise.all([
                ReportService.generateVisitSummaryReport({ supervisorID, dateRange, regionID, status, visitReasons, agentID }),
                ReportService.generateTimesheetReport({ supervisorID, regionalManagerID, dateRange, status }),
                ReportService.generateReceiptBookInventoryReport({ dateRange, regionID }),
                ReportService.generateStubCollectionReport({ agentID, supervisorID, regionalManagerID, dateRange, status }),
                ReportService.generateUserActivityReport({ dateRange }),
                ReportService.generateAIAnomalyReport({ dateRange }),
                ReportService.generateAgentPerformanceReport({ supervisorID, regionalManagerID, dateRange, agentID, regionID }),
                ReportService.generateRegionPerformance({ regionalManagerID, dateRange, regionID })
            ]);

            return {
                visitSummaryReport,
                timesheetReport,
                receiptBookInventoryReport,
                stubCollectionReport,
                userActivityReport,
                aiAnomalyReport,
                agentPerformanceReport,
                regionPerformanceReport
            };
        } catch (error) {
            logger.error(`Failed to generate Full report: ${error.message}`, {
                route: 'reports', service: 'api', metadata: { filters }
            });
            throw new Error(`Failed to generate Full report: ${error.message}`);
        }
    }










    static async exportReport(reportType, data, format) {
        const reportName = `${reportType}_${Date.now()}`;
        const filePath = path.join(__dirname, '../reports', `${reportName}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);

        try {
            // Ensure reports directory exists
            const dirPath = path.dirname(filePath);
            try {
                await fs.access(dirPath);
            } catch {
                await fs.mkdir(dirPath, { recursive: true });
            }

            if (format === 'pdf') {
                await this.generatePDF(data, reportType, filePath);
            } else if (format === 'excel') {
                await this.generateExcel(data, reportType, filePath);
            } else {
                throw new Error(`Unsupported format: ${format}`);
            }

            // Verify file was created
            await fs.access(filePath).catch(() => {
                throw new Error(`Failed to create report file: ${filePath}`);
            });

            logger.info(`Successfully exported ${reportType} report to ${filePath}`, {
                route: 'reports', service: 'api', metadata: { reportType, format }
            });

            return filePath;
        } catch (error) {
            logger.error(`Failed to export ${reportType} report: ${error.message}`, {
                route: 'reports', service: 'api', metadata: { reportType, format, filePath }
            });
            throw new Error(`Failed to export ${reportType}: ${error.message}`);
        }
    }

    static async generatePDF(data, reportType, filePath) {
        return new Promise(async (resolve, reject) => {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 40,
                bufferPages: true
            });

            const writeStream = require('fs').createWriteStream(filePath);
            doc.pipe(writeStream);

            // Handle stream errors
            writeStream.on('error', (err) => {
                logger.error(`Failed to write PDF to ${filePath}: ${err.message}`, {
                    route: 'reports', service: 'api', metadata: { reportType, filePath }
                });
                reject(err);
            });

            // Resolve when stream finishes
            writeStream.on('finish', () => {
                logger.debug(`Successfully wrote PDF to ${filePath}`, {
                    route: 'reports', service: 'api', metadata: { reportType }
                });
                resolve();
            });

            try {
                // Register fonts
                try {
                    doc.registerFont('Roboto-Regular', path.join(__dirname, '../Templates/fonts/Roboto-Regular.ttf'));
                    doc.registerFont('Roboto-Bold', path.join(__dirname, '../Templates/fonts/Roboto-Bold.ttf'));
                } catch (fontError) {
                    logger.warn(`Failed to load fonts, using default: ${fontError.message}`, {
                        route: 'reports', service: 'api', metadata: { reportType }
                    });
                }

                // Header
                const logoPath = path.join(__dirname, '../Templates/logo/Logo.png');
                try {
                    await fs.access(logoPath);
                    doc.image(logoPath, 40, 30, { width: 50 });
                } catch (e) {
                    logger.warn(`Logo not found at ${logoPath}`, { route: 'reports', service: 'api', metadata: 'api' });
                }

                doc.font('Roboto-Bold')
                    .fontSize(24)
                    .fillColor('#333333')
                    .text(`TraceFlow ${reportType} Report`, 0, 40, { align: 'center' });
                doc.font('Roboto-Regular')
                    .fontSize(10)
                    .fillColor('#666666')
                    .text(`Generated on ${new Date().toLocaleString()}`, 0, 70, { align: 'center' });

                // Separator line
                doc.moveTo(20, 90).lineTo(575, 90).strokeColor('#CCCCCC').lineWidth(1).stroke();
                doc.moveDown(2);

                if (reportType === 'Full') {
                    for (const [section, sectionData] of Object.entries(data)) {
                        doc.addPage();
                        doc.font('Roboto-Bold')
                            .fontSize(18)
                            .fillColor('#333333')
                            .text(section.replace(/([A-Z])/g, ' $1').trim(), 20, 30, { underline: true });
                        doc.moveDown(1);

                        // Summary section
                        doc.font('Roboto-Bold')
                            .fontSize(14)
                            .fillColor('#005566')
                            .text('Summary', 20, doc.y, { underline: true });
                        doc.moveDown(0.5);
                        doc.font('Roboto-Regular')
                            .fontSize(11)
                            .fillColor('#333333');
                        for (const [key, value] of Object.entries(sectionData.summary)) {
                            doc.text(`${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}`, 30, doc.y, { continued: false });
                            doc.moveDown(0.3);
                        }
                        doc.moveDown(1);

                        // Details section
                        if (sectionData.details && sectionData.details.length) {
                            doc.font('Roboto-Bold')
                                .fontSize(14)
                                .fillColor('#005566')
                                .text('Details', 20, doc.y, { underline: true });
                            const headers = Object.keys(sectionData.details[0]).map(h => h.replace(/([A-Z])/g, ' $1').trim());
                            const colWidths = headers.map(() => 555 / headers.length);
                            const tableTop = doc.y + 10;
                            let y = this._drawTable(doc, headers, sectionData.details, tableTop, colWidths);

                            if (y + 80 > doc.page.height - 40) {
                                doc.addPage();
                                y = 30;
                            }
                            doc.font('Roboto-Regular')
                                .fontSize(10)
                                .fillColor('#666666')
                                .text('Generated by TraceFlow', 20, y + 20);
                            doc.fontSize(8)
                                .text(`Generated at: ${new Date().toLocaleString()}`, 20, y + 35);
                            doc.moveTo(20, y + 50)
                                .lineTo(220, y + 50)
                                .strokeColor('#005566')
                                .lineWidth(1)
                                .stroke();
                        }
                    }
                } else {
                    // Summary section for single report
                    doc.font('Roboto-Bold')
                        .fontSize(14)
                        .fillColor('#005566')
                        .text('Summary', 20, doc.y, { underline: true });
                    doc.moveDown(0.5);
                    doc.font('Roboto-Regular')
                        .fontSize(11)
                        .fillColor('#333333');
                    for (const [key, value] of Object.entries(data.summary)) {
                        doc.text(`${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}`, 30, doc.y, { continued: false });
                        doc.moveDown(0.3);
                    }
                    doc.moveDown(1);

                    // Details section
                    if (data.details && data.details.length) {
                        doc.font('Roboto-Bold')
                            .fontSize(14)
                            .fillColor('#005566')
                            .text('Details', 20, doc.y, { underline: true });
                        const headers = Object.keys(data.details[0]).map(h => h.replace(/([A-Z])/g, ' $1').trim());
                        const colWidths = headers.map(() => 555 / headers.length);
                        const tableTop = doc.y + 10;
                        let y = this._drawTable(doc, headers, data.details, tableTop, colWidths);

                        doc.font('Roboto-Regular')
                            .fontSize(10)
                            .fillColor('#666666')
                            .text('Generated by TraceFlow', 20, y + 20);
                        doc.fontSize(8)
                            .text(`Generated at: ${new Date().toLocaleString()}`, 20, y + 35);
                        doc.moveTo(20, y + 50)
                            .lineTo(220, y + 50)
                            .strokeColor('#005566')
                            .lineWidth(1)
                            .stroke();
                    }
                }

                // Page numbering
                const pageCount = doc.bufferedPageRange().count;
                for (let i = 0; i < pageCount; i++) {
                    doc.switchToPage(i);
                    doc.font('Roboto-Regular')
                        .fontSize(8)
                        .fillColor('#999999')
                        .text(`Page ${i + 1} of ${pageCount}`, 0, doc.page.height - 30, { align: 'center' });
                }

                doc.end();
            } catch (error) {
                logger.error(`Error generating PDF: ${error.message}`, {
                    route: 'reports', service: 'api', metadata: { reportType, filePath }
                });
                reject(error);
            }
        });
    }

    static _drawTable(doc, headers, data, startY, colWidths) {
        let y = startY;

        // Header background
        doc.rect(20, y - 5, 555, 25)
            .fill('#F0F0F0');

        // Draw headers
        doc.font('Roboto-Bold')
            .fontSize(10)
            .fillColor('#333333');
        headers.forEach((header, i) => {
            doc.text(header, 25 + (i * colWidths[i]), y, { width: colWidths[i] - 10, align: 'left' });
        });
        y += 25;

        // Draw data rows
        data.forEach((row, rowIndex) => {
            const rowHeight = Math.max(...headers.map((_, i) => {
                const text = String(row[headers[i].toLowerCase().replace(/\s/g, '')] || 'N/A');
                return doc.heightOfString(text, { width: colWidths[i] - 10 });
            }), 20) + 10;

            // Page break check
            if (y + rowHeight > doc.page.height - 50) {
                doc.addPage();
                y = 30;
                doc.rect(20, y - 5, 555, 25)
                    .fill('#F0F0F0');
                doc.font('Roboto-Bold')
                    .fontSize(10)
                    .fillColor('#333333');
                headers.forEach((header, i) => {
                    doc.text(header, 25 + (i * colWidths[i]), y, { width: colWidths[i] - 10, align: 'left' });
                });
                y += 25;
            }

            // Row background
            if (rowIndex % 2 === 0) {
                doc.rect(20, y - 5, 555, rowHeight)
                    .fill('#F9F9F9');
            }

            // Row data
            doc.font('Roboto-Regular')
                .fontSize(8)
                .fillColor('#333333');
            headers.forEach((header, i) => {
                const text = String(row[header.toLowerCase().replace(/\s/g, '')] || 'N/A');
                doc.text(text, 25 + (i * colWidths[i]), y, { width: colWidths[i] - 10, align: 'left' });
            });

            // Row separator
            doc.moveTo(20, y + rowHeight)
                .lineTo(575, y + rowHeight)
                .strokeColor('#CCCCCC')
                .lineWidth(0.5)
                .stroke();

            y += rowHeight;
        });

        // Vertical lines
        let x = 20;
        colWidths.forEach((width) => {
            doc.moveTo(x, startY - 5)
                .lineTo(x, y)
                .strokeColor('#CCCCCC')
                .lineWidth(0.5)
                .stroke();
            x += width;
        });

        return y;
    }

    static async generateExcel(data, reportType, filePath) {
        const workbook = new ExcelJS.Workbook();
        workbook.created = new Date();
        workbook.modified = new Date();
        workbook.creator = 'TraceFlow';

        // Styles
        const headerStyle = {
            font: { name: 'Arial', size: 12, bold: true, color: { argb: '333333' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0F0F0' } },
            alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
            border: {
                top: { style: 'thin', color: { argb: 'CCCCCC' } },
                bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
                left: { style: 'thin', color: { argb: 'CCCCCC' } },
                right: { style: 'thin', color: { argb: 'CCCCCC' } }
            }
        };
        const cellStyle = {
            font: { name: 'Arial', size: 10, color: { argb: '333333' } },
            alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
            border: {
                top: { style: 'thin', color: { argb: 'CCCCCC' } },
                bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
                left: { style: 'thin', color: { argb: 'CCCCCC' } },
                right: { style: 'thin', color: { argb: 'CCCCCC' } }
            }
        };
        const titleStyle = {
            font: { name: 'Arial', size: 14, bold: true, color: { argb: '333333' } },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };
        const footerStyle = {
            font: { name: 'Arial', size: 8, color: { argb: '666666' } },
            alignment: { horizontal: 'left', vertical: 'middle' }
        };

        try {
            if (reportType === 'Full') {
                for (const [section, sectionData] of Object.entries(data)) {
                    // Summary sheet
                    const summarySheet = workbook.addWorksheet(`${section} Summary`.slice(0, 31));
                    summarySheet.getRow(1).getCell(1).value = `${section.replace(/([A-Z])/g, ' $1').trim()} Summary`;
                    summarySheet.getRow(1).getCell(1).style = titleStyle;
                    summarySheet.mergeCells('A1:D1');

                    let rowIndex = 3;
                    for (const [key, value] of Object.entries(sectionData.summary)) {
                        const row = summarySheet.getRow(rowIndex);
                        row.getCell(1).value = key.replace(/([A-Z])/g, ' $1').trim();
                        row.getCell(2).value = value;
                        row.getCell(1).style = headerStyle;
                        row.getCell(2).style = cellStyle;
                        rowIndex++;
                    }
                    summarySheet.getRow(rowIndex + 1).getCell(1).value = `Generated at: ${new Date().toLocaleString()}`;
                    summarySheet.getRow(rowIndex + 1).getCell(1).style = footerStyle;

                    // Auto-size columns
                    summarySheet.columns = [
                        { width: 30 },
                        { width: 20 }
                    ];

                    // Details sheet
                    if (sectionData.details && sectionData.details.length) {
                        const detailSheet = workbook.addWorksheet(`${section} Details`.slice(0, 31));
                        detailSheet.getRow(1).getCell(1).value = `${section.replace(/([A-Z])/g, ' $1').trim()} Details`;
                        detailSheet.getRow(1).getCell(1).style = titleStyle;
                        detailSheet.mergeCells(1, 1, 1, Object.keys(sectionData.details[0]).length);

                        const headers = Object.keys(sectionData.details[0]).map(h => h.replace(/([A-Z])/g, ' $1').trim());
                        const headerRow = detailSheet.getRow(3);
                        headers.forEach((header, i) => {
                            headerRow.getCell(i + 1).value = header;
                            headerRow.getCell(i + 1).style = headerStyle;
                        });

                        sectionData.details.forEach((rowData, i) => {
                            const row = detailSheet.getRow(i + 4);
                            headers.forEach((header, j) => {
                                row.getCell(j + 1).value = rowData[header.toLowerCase().replace(/\s/g, '')] || 'N/A';
                                row.getCell(j + 1).style = cellStyle;
                            });
                        });

                        detailSheet.getRow(sectionData.details.length + 5).getCell(1).value = `Generated at: ${new Date().toLocaleString()}`;
                        detailSheet.getRow(sectionData.details.length + 5).getCell(1).style = footerStyle;

                        detailSheet.columns = headers.map(() => ({ width: 20 }));
                    }
                }
            } else {
                // Summary sheet
                const summarySheet = workbook.addWorksheet('Summary');
                summarySheet.getRow(1).getCell(1).value = `${reportType.replace(/([A-Z])/g, ' $1').trim()} Summary`;
                summarySheet.getRow(1).getCell(1).style = titleStyle;
                summarySheet.mergeCells('A1:D1');

                let rowIndex = 3;
                for (const [key, value] of Object.entries(data.summary)) {
                    const row = summarySheet.getRow(rowIndex);
                    row.getCell(1).value = key.replace(/([A-Z])/g, ' $1').trim();
                    row.getCell(2).value = value;
                    row.getCell(1).style = headerStyle;
                    row.getCell(2).style = cellStyle;
                    rowIndex++;
                }
                summarySheet.getRow(rowIndex + 1).getCell(1).value = `Generated at: ${new Date().toLocaleString()}`;
                summarySheet.getRow(rowIndex + 1).getCell(1).style = footerStyle;

                summarySheet.columns = [
                    { width: 30 },
                    { width: 20 }
                ];

                // Details sheet
                if (data.details && data.details.length) {
                    const detailSheet = workbook.addWorksheet('Details');
                    detailSheet.getRow(1).getCell(1).value = `${reportType.replace(/([A-Z])/g, ' $1').trim()} Details`;
                    detailSheet.getRow(1).getCell(1).style = titleStyle;
                    detailSheet.mergeCells(1, 1, 1, Object.keys(data.details[0]).length);

                    const headers = Object.keys(data.details[0]).map(h => h.replace(/([A-Z])/g, ' $1').trim());
                    const headerRow = detailSheet.getRow(3);
                    headers.forEach((header, i) => {
                        headerRow.getCell(i + 1).value = header;
                        headerRow.getCell(i + 1).style = headerStyle;
                    });

                    data.details.forEach((rowData, i) => {
                        const row = detailSheet.getRow(i + 4);
                        headers.forEach((header, j) => {
                            row.getCell(j + 1).value = rowData[header.toLowerCase().replace(/\s/g, '')] || 'N/A';
                            row.getCell(j + 1).style = cellStyle;
                        });
                    });

                    detailSheet.getRow(data.details.length + 5).getCell(1).value = `Generated at: ${new Date().toLocaleString()}`;
                    detailSheet.getRow(data.details.length + 5).getCell(1).style = footerStyle;

                    detailSheet.columns = headers.map(() => ({ width: 20 }));
                }
            }

            await workbook.xlsx.writeFile(filePath);
            logger.info(`Excel report generated at ${filePath}`, {
                route: 'reports', service: 'api', metadata: { reportType }
            });
        } catch (error) {
            logger.error(`Failed to generate Excel report: ${error.message}`, {
                route: 'reports', service: 'api', metadata: { reportType, filePath }
            });
            throw new Error(`Failed to generate Excel report: ${error.message}`);
        }
    }
}

module.exports = ReportService;