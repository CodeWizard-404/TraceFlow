const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const AIService = require('./aiService')
const fs = require('fs').promises;
const path = require('path');
const { Op, literal } = require('sequelize');
const {
    Visit, Role, Timesheet, ReceiptBook, ReceiptStub, User, Log, Agent, Region,
    Delegation, Governorate, ReceiptBookType, Reason, Checklist, VisitChecklist
} = require('../models');
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









    static async generateVisitSummaryReport(filters = {}) {
        // Define allowed filters
        const allowedFilters = [
            'supervisorID', 'dateRange', 'regionID', 'agentID', 'status', 'visitReasons',
            'checklistCompleted', 'visitDuration', 'governorateID', 'delegationID',
            'visitType', 'Anomalies', 'dayOfWeek'
        ];

        // Initialize where clauses
        const where = {};
        const userWhere = {};
        const agentWhere = {};
        const delegationWhere = {};
        const governorateWhere = {};
        let reasonWhere = {};
        let visitChecklistWhere = {};

        // Validate and apply filters
        if (filters.supervisorID) {
            if (typeof filters.supervisorID === 'string') {
                userWhere.userID = filters.supervisorID;
            } else {
                throw new Error('Invalid supervisorID: must be a string');
            }
        }

        if (filters.dateRange && filters.dateRange.start && filters.dateRange.end) {
            try {
                where.date = {
                    [Op.between]: [
                        new Date(filters.dateRange.start),
                        new Date(filters.dateRange.end)
                    ]
                };
            } catch (error) {
                throw new Error('Invalid date range: start and end must be valid dates');
            }
        }

        if (filters.agentID) {
            if (typeof filters.agentID === 'string') {
                where.agentID = filters.agentID;
            } else {
                throw new Error('Invalid agentID: must be a string');
            }
        }

        if (filters.status && Array.isArray(filters.status) && filters.status.length) {
            where.status = { [Op.in]: filters.status };
        }

        if (filters.regionID) {
            if (typeof filters.regionID === 'string') {
                governorateWhere.regionID = filters.regionID;
            } else {
                throw new Error('Invalid regionID: must be a string');
            }
        }

        if (filters.governorateID) {
            if (typeof filters.governorateID === 'string') {
                delegationWhere.governorateID = filters.governorateID;
            } else {
                throw new Error('Invalid governorateID: must be a string');
            }
        }

        if (filters.delegationID) {
            if (typeof filters.delegationID === 'string') {
                agentWhere.delegationID = filters.delegationID;
            } else {
                throw new Error('Invalid delegationID: must be a string');
            }
        }

        if (filters.visitDuration && Array.isArray(filters.visitDuration) && filters.visitDuration.length === 2) {
            const [min, max] = filters.visitDuration.map(Number);
            if (!isNaN(min) && !isNaN(max) && min <= max) {
                where.duration = { [Op.between]: [min, max] };
            } else {
                throw new Error('Invalid visitDuration: must be an array of two numbers, min <= max');
            }
        }

        if (filters.visitType) {
            if (typeof filters.visitType !== 'string') {
                throw new Error('Invalid visitType: must be a string');
            }
            if (filters.visitType === 'recrutementVisits') {
                where.agentID = { [Op.is]: null };
            } else {
                where.visitType = filters.visitType;
            }
        }

        if (filters.visitReasons && Array.isArray(filters.visitReasons) && filters.visitReasons.length) {
            reasonWhere = { item: { [Op.in]: filters.visitReasons } };
        }

        if (filters.checklistCompleted !== undefined) {
            if (typeof filters.checklistCompleted === 'boolean') {
                visitChecklistWhere = { checked: filters.checklistCompleted };
            } else {
                throw new Error('Invalid checklistCompleted: must be a boolean');
            }
        }

        if (filters.dayOfWeek) {
            if (typeof filters.dayOfWeek === 'string' && ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(filters.dayOfWeek)) {
                where[Op.and] = where[Op.and] || [];
                where[Op.and].push(literal(`EXTRACT(DOW FROM "Visit"."date") = ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(filters.dayOfWeek)}`));
            } else {
                throw new Error('Invalid dayOfWeek: must be a valid day name (e.g., "Monday")');
            }
        }

        let anomalyVisitIds = [];
        if (filters.Anomalies === true) {
            try {
                const anomalyLogs = await Log.findAll({
                    where: { level: ['warn', 'error'], route: { [Op.iLike]: '%visit%' } },
                    attributes: ['metadata']
                });
                anomalyVisitIds = anomalyLogs
                    .map(log => log.metadata?.visitID)
                    .filter(id => id && typeof id === 'string');
                if (anomalyVisitIds.length) {
                    where.visitID = { [Op.in]: anomalyVisitIds };
                } else {
                    return { summary: { totalVisits: 0, validatedVisits: 0, pendingVisits: 0, visitedVisits: 0, rejectedVisits: 0, averageDuration: '0.00' }, details: [], aiSummary: 'No anomalies found' };
                }
            } catch (error) {
                logger.warn('Failed to fetch anomaly logs for VisitSummary report:', error.message);
                throw new Error('Failed to process anomalies filter');
            }
        } else if (filters.Anomalies !== undefined && filters.Anomalies !== false) {
            throw new Error('Invalid Anomalies: must be a boolean');
        }

        try {
            const visits = await Visit.findAll({
                where,
                include: [
                    {
                        model: Agent,
                        where: agentWhere,
                        required: !!filters.agentID || !!filters.delegationID,
                        include: [
                            {
                                model: Delegation,
                                where: delegationWhere,
                                required: !!filters.delegationID || !!filters.governorateID,
                                include: [
                                    {
                                        model: Governorate,
                                        where: governorateWhere,
                                        required: !!filters.governorateID || !!filters.regionID,
                                        include: [{ model: Region, required: !!filters.regionID }],
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        model: Timesheet,
                        include: [{ model: User, where: userWhere, required: !!filters.supervisorID }],
                        required: !!filters.supervisorID,
                    },
                    {
                        model: Reason,
                        where: reasonWhere,
                        through: { attributes: [] },
                        required: !!(filters.visitReasons && filters.visitReasons.length),
                    },
                    {
                        model: Checklist,
                        through: { model: VisitChecklist, attributes: ['checked'], where: visitChecklistWhere },
                        required: filters.checklistCompleted !== undefined,
                    },
                ],
            });

            // Compute summary stats
            const totalVisits = visits.length;
            const validatedVisits = visits.filter(v => v.status === 'validated').length;
            const pendingVisits = visits.filter(v => v.status === 'pending').length;
            const visitedVisits = visits.filter(v => v.status === 'visited').length;
            const rejectedVisits = visits.filter(v => v.status === 'rejected').length;
            const averageDuration = totalVisits > 0
                ? visits.reduce((sum, v) => sum + (v.duration || 0), 0) / totalVisits / 60
                : 0;

            // Format report data
            const reportData = {
                summary: {
                    totalVisits,
                    validatedVisits,
                    pendingVisits,
                    visitedVisits,
                    rejectedVisits,
                    averageDuration: averageDuration.toFixed(2),
                },
                details: visits.map(v => {
                    // Safely handle date field
                    let formattedDate = 'N/A';
                    if (v.date) {
                        if (v.date instanceof Date) {
                            formattedDate = v.date.toISOString().split('T')[0];
                        } else if (typeof v.date === 'string') {
                            const parsedDate = new Date(v.date);
                            formattedDate = isNaN(parsedDate.getTime()) ? 'N/A' : parsedDate.toISOString().split('T')[0];
                        }
                    }

                    return {
                        date: formattedDate,
                        location: v.location || 'N/A',
                        status: v.status || 'N/A',
                        agent: v.Agent ? `${v.Agent.name || ''} ${v.Agent.lastname || ''}`.trim() || 'No Agent' : 'No Agent',
                        supervisor: v.Timesheet?.User ? `${v.Timesheet.User.firstname || ''} ${v.Timesheet.User.lastname || ''}`.trim() : 'N/A',
                        duration: v.duration != null ? (v.duration / 60).toFixed(2) : 'N/A',
                        reasons: v.Reasons ? v.Reasons.map(r => r.item).join(', ') || 'N/A' : 'N/A',
                        checklistCompleted: v.Checklists.length > 0 ? v.Checklists.some(c => c.VisitChecklist?.checked) : false,
                    };
                }),
            };

            // Generate AI summary
            try {
                const aiSummary = await AIService.generateReport(
                    { ...filters, reportType: 'VisitSummary', data: reportData },
                    'json',
                    new AbortController()
                );
                reportData.aiSummary = aiSummary.summary || 'No AI summary available';
            } catch (error) {
                logger.warn('AI summary generation failed for VisitSummary report:', error.message);
                reportData.aiSummary = 'AI summary unavailable';
            }

            return reportData;
        } catch (error) {
            logger.error(`Failed to generate VisitSummary report: ${error.message}`, {
                filters,
                error: error.stack
            });
            throw new Error(`Failed to generate VisitSummary report: ${error.message}`);
        }
    }



    static async generateTimesheetReport(filters) {
        const allowedFilters = [
            'supervisorID', 'regionalManagerID', 'directorID', 'dateRange', 'status', 'numberOfVisits',
            'totalHours', 'aiSuggestions', 'anomaliesDetected', 'visitStatus', 'weekNumber',
            'directorName', 'checklistCompleted'
        ];
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

            const reportData = {
                summary: {
                    totalTimesheets: filteredTimesheets.length,
                    totalHours: filteredTimesheets.reduce((sum, t) => sum + t.Visits.reduce((s, v) => s + (v.duration || 0), 0), 0) / 60,
                    validatedTimesheets: filteredTimesheets.filter(t => t.status === 'validated').length,
                    pendingTimesheets: filteredTimesheets.filter(t => t.status === 'pending').length,
                    rejectedTimesheets: filteredTimesheets.filter(t => t.status === 'rejected').length
                },
                details: filteredTimesheets.map(t => ({
                    supervisor: t.User ? `${t.User.firstname} ${t.User.lastname}` : 'N/A',
                    week: `${t.weekNumber}/${t.year}`,
                    status: t.status || 'N/A',
                    totalHours: (t.Visits.reduce((sum, v) => sum + (v.duration || 0), 0) / 60).toFixed(2),
                    visitReasons: t.Visits.map(v => v.Reasons?.map(r => r.item).join(', ') || 'N/A').join('; '),
                    numberOfVisits: t.Visits.length,
                    checklistCompleted: t.Visits.every(v => v.Checklists.every(c => c.VisitChecklist?.checked === true))
                }))
            };

            // Generate AI summary
            try {
                const aiSummary = await AIService.generateReport(
                    { ...filters, reportType: 'Timesheet', data: reportData },
                    'json',
                    new AbortController()
                );
                reportData.aiSummary = aiSummary.summary || 'No AI summary available';
            } catch (error) {
                reportData.aiSummary = 'AI summary unavailable';
            }
            return reportData;
        } catch (error) {
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

        if (dateRange) {
            if (!dateRange.start || !dateRange.end) {
                throw new Error('Invalid date range: both start and end dates are required');
            }
            const visitsInRange = await Visit.findAll({
                where: {
                    date: { [Op.between]: [new Date(dateRange.start), new Date(dateRange.end)] },
                    agentID: { [Op.ne]: null }
                },
                attributes: ['agentID'],
                include: [{
                    model: Agent,
                    attributes: [],
                    include: [{
                        model: Delegation,
                        where: delegationWhere,
                        required: !!delegationID,
                        include: [{
                            model: Governorate,
                            where: governorateWhere,
                            required: !!governorateID || !!regionID
                        }]
                    }]
                }]
            });
            const agentIDs = [...new Set(visitsInRange.map(v => v.agentID).filter(id => id))];

            if (agentIDs.length > 0) {
                agentWhere.agentID = { [Op.in]: agentIDs };
            } else {
                where.agentID = null;
            }
        }

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
                    },
                    { model: ReceiptStub, required: false }
                ]
            });

            const reportData = {
                summary: {
                    totalBooks: receiptBooks.length,
                    inStock: receiptBooks.filter(b => b.status === 'In Stock').length,
                    withAgents: receiptBooks.filter(b => b.status === 'Assigned to Agent').length,
                    withSupervisors: receiptBooks.filter(b => b.status === 'With Supervisor').length,
                    archived: receiptBooks.filter(b => b.status === 'Archived').length
                },
                details: receiptBooks.map(b => ({
                    number: b.number || 'N/A',
                    status: b.status || 'N/A',
                    type: b.ReceiptBookType?.name || 'N/A',
                    currentHolder: b.CurrentHolder
                        ? `${b.CurrentHolder.firstname} ${b.CurrentHolder.lastname}`
                        : b.Agent
                            ? `${b.Agent.name} ${b.Agent.lastname}`
                            : 'N/A',
                    assignedToAgent: !!b.agentID,
                    stubStatus: b.ReceiptStub?.status || 'N/A'
                }))
            };

            // Generate AI summary
            try {
                const aiSummary = await AIService.generateReport(
                    { ...filters, reportType: 'ReceiptBookInventory', data: reportData },
                    'json',
                    new AbortController()
                );
                reportData.aiSummary = aiSummary.summary || 'No AI summary available';
            } catch (error) {
                reportData.aiSummary = 'AI summary unavailable';
            }

            return reportData;
        } catch (error) {
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

            const reportData = {
                summary: {
                    totalStubs: stubs.length,
                    collected: stubs.filter(s => s.status === 'collected').length,
                    transmitted: stubs.filter(s => s.status === 'transmitted').length,
                    archived: stubs.filter(s => s.status === 'archived').length,
                    pending: stubs.filter(s => s.status === 'pending').length
                },
                details: stubs.map(s => ({
                    bookNumber: s.ReceiptBook?.number || 'N/A',
                    status: s.status || 'N/A',
                    agent: s.ReceiptBook?.Agent
                        ? `${s.ReceiptBook.Agent.name} ${s.ReceiptBook.Agent.lastname}`
                        : 'N/A',
                    currentHolder: s.ReceiptBook?.CurrentHolder
                        ? `${s.ReceiptBook.CurrentHolder.firstname} ${s.ReceiptBook.CurrentHolder.lastname}`
                        : 'N/A',
                }))
            };

            // Generate AI summary
            try {
                const aiSummary = await AIService.generateReport(
                    { ...filters, reportType: 'StubCollection', data: reportData },
                    'json',
                    new AbortController()
                );
                reportData.aiSummary = aiSummary.summary || 'No AI summary available';
            } catch (error) {
                reportData.aiSummary = 'AI summary unavailable';
            }

            return reportData;
        } catch (error) {
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

            const reportData = {
                summary: {
                    totalActivities: filteredLogs.length,
                    uniqueUsers: [...new Set(filteredLogs.map(l => l.userId).filter(id => id))].length,
                    suspiciousActivities: filteredLogs.filter(l => ['warn', 'error'].includes(l.level)).length,
                    lastActivity: filteredLogs.length
                        ? new Date(Math.max(...filteredLogs.map(l => new Date(l.timestamp).getTime()))).toISOString()
                        : 'N/A'
                },
                details: filteredLogs.map(l => ({
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

            // Generate AI summary
            try {
                const aiSummary = await AIService.generateReport(
                    { ...filters, reportType: 'UserActivity', data: reportData },
                    'json',
                    new AbortController()
                );
                reportData.aiSummary = aiSummary.summary || 'No AI summary available';
            } catch (error) {
                reportData.aiSummary = 'AI summary unavailable';
            }

            return reportData;
        } catch (error) {
            throw new Error(`Failed to generate UserActivity report: ${error.message}`);
        }
    }

    static async generateAnomalyReport(filters) {
        const allowedFilters = [
            'dateRange', 'roleID', 'userID', 'affectedEntity',
            'severity', 'route'
        ];
        let {
            dateRange, roleID, userID, affectedEntity, severity = ['warn', 'error'], route
        } = ReportService.validateFilters(filters, allowedFilters);

        // Ensure severity is an array
        if (typeof severity === 'string') {
            severity = [severity];
        } else if (!Array.isArray(severity)) {
            logger.warn('Invalid severity filter, defaulting to ["warn", "error"]', { severity });
            severity = ['warn', 'error'];
        }

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
            if (!Array.isArray(logs)) {
                logger.error('Log.findAll did not return an array', { logs });
                throw new Error('Invalid log data returned from database');
            }
            logger.debug('Logs retrieved for Anomaly report', { count: logs.length, filters });

            const userIds = [...new Set(logs.map(l => l.userId).filter(id => id))];
            logger.debug('Unique user IDs', { userIds });

            const users = await User.findAll({
                where: { userID: { [Op.in]: userIds }, ...userWhere },
                include: [{
                    model: Role,
                    where: roleWhere,
                    required: !!roleID,
                    through: { attributes: [] }
                }]
            });
            if (!Array.isArray(users)) {
                logger.error('User.findAll did not return an array', { users });
                throw new Error('Invalid user data returned from database');
            }
            logger.debug('Users retrieved for Anomaly report', { count: users.length });

            const userMap = users.reduce((map, user) => {
                map[user.userID] = {
                    firstname: user.firstname || 'N/A',
                    lastname: user.lastname || 'N/A',
                    role: user.Roles?.[0]?.name || 'N/A'
                };
                return map;
            }, {});

            const reportData = {
                summary: {
                    totalAnomalies: logs.length,
                    warningAnomalies: logs.filter(l => l.level === 'warn').length,
                    errorAnomalies: logs.filter(l => l.level === 'error').length,
                    uniqueUsers: userIds.length
                },
                details: logs.map(l => ({
                    user: l.userId && userMap[l.userId]
                        ? `${userMap[l.userId].firstname} ${userMap[l.userId].lastname}`
                        : 'N/A',
                    role: l.userId && userMap[l.userId] ? userMap[l.userId].role : 'N/A',
                    anomaly: l.message || 'N/A',
                    affected: l.route?.includes('timesheet') ? 'Timesheet'
                        : l.route?.includes('visit') ? 'Visit'
                            : l.route?.includes('receipt') ? 'Receipt'
                                : 'Other',
                    severity: l.level,
                    timestamp: l.timestamp ? l.timestamp.toISOString() : 'N/A',
                    route: l.route || 'N/A'
                }))
            };

            try {
                const aiSummary = await AIService.generateReport(
                    { ...filters, reportType: 'Anomaly', data: reportData },
                    'json',
                    new AbortController()
                );
                logger.debug('AI summary response', { aiSummary });
                reportData.aiSummary = typeof aiSummary?.summary === 'string'
                    ? aiSummary.summary
                    : 'No AI summary available';
            } catch (error) {
                logger.warn('AI summary generation failed for Anomaly report', { error: error.message });
                reportData.aiSummary = 'AI summary unavailable';
            }

            return reportData;
        } catch (error) {
            logger.error('Error in generateAnomalyReport', { error: error.message, stack: error.stack, filters });
            throw new Error(`Failed to generate Anomaly report: ${error.message}`);
        }
    }

    static async generateAgentPerformanceReport(filters) {
        const allowedFilters = [
            'supervisorID', 'regionalManagerID', 'dateRange', 'agentID',
            'numberOfVisits', 'stubsCollected', 'receiptBooksAssigned', 'regionID', 'governorateID',
            'delegationID', 'locationUpdated'
        ];
        const {
            supervisorID, regionalManagerID, dateRange, agentID,
            numberOfVisits, stubsCollected, receiptBooksAssigned, regionID, governorateID,
            delegationID, locationUpdated
        } = ReportService.validateFilters(filters, allowedFilters);

        const where = {};
        const visitWhere = {};
        const delegationWhere = {};
        const governorateWhere = {};
        const userWhere = {};

        if (supervisorID) where.supervisorID = supervisorID;
        if (regionalManagerID) userWhere.regionalManagerID = regionalManagerID;
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
                            include: [{ model: Region, required: !!regionID }]
                        }],
                        required: !!delegationID
                    },
                    { model: User, as: 'Supervisor', where: userWhere, required: !!regionalManagerID }
                ]
            });

            let filteredAgents = agents;
            if (numberOfVisits) filteredAgents = filteredAgents.filter(a => a.Visits.length >= numberOfVisits[0] && a.Visits.length <= numberOfVisits[1]);
            if (stubsCollected) filteredAgents = filteredAgents.filter(a => {
                const collected = a.ReceiptBooks.reduce((sum, b) => sum + (b.ReceiptStub?.status === 'collected' ? 1 : 0), 0);
                return collected >= stubsCollected[0] && collected <= stubsCollected[1];
            });
            if (receiptBooksAssigned) filteredAgents = filteredAgents.filter(a => a.ReceiptBooks.length >= receiptBooksAssigned[0] && a.ReceiptBooks.length <= receiptBooksAssigned[1]);
            if (locationUpdated !== undefined) filteredAgents = filteredAgents.filter(a => (a.latitude && a.longitude) === locationUpdated);

            const reportData = {
                summary: {
                    totalAgents: filteredAgents.length,
                    totalVisits: filteredAgents.reduce((sum, a) => sum + a.Visits.length, 0),
                    totalStubsCollected: filteredAgents.reduce((sum, a) => sum + (a.ReceiptBooks?.reduce((s, b) => s + (b.ReceiptStub?.status === 'collected' ? 1 : 0), 0) || 0), 0),
                    totalReceiptBooksAssigned: filteredAgents.reduce((sum, a) => sum + a.ReceiptBooks.length, 0),
                    averagePerformanceScore: filteredAgents.length
                        ? (filteredAgents.reduce((sum, a) => {
                            const score = a.Visits.length ? (a.Visits.filter(v => v.status === 'completed').length / a.Visits.length) * 100 : 0;
                            return sum + score;
                        }, 0) / filteredAgents.length).toFixed(1)
                        : '0.0'
                },
                details: filteredAgents.map(a => ({
                    name: `${a.name || 'N/A'} ${a.lastname || ''}`,
                    visitsReceived: a.Visits.length,
                    stubsCollected: a.ReceiptBooks.reduce((sum, b) => sum + (b.ReceiptStub?.status === 'collected' ? 1 : 0), 0),
                    receiptBooksAssigned: a.ReceiptBooks.length,
                    region: a.Delegation?.Governorate?.Region?.name || 'N/A',
                    supervisor: a.Supervisor ? `${a.Supervisor.firstname} ${a.Supervisor.lastname}` : 'N/A',
                    locationUpdated: !!(a.latitude && a.longitude)
                }))
            };

            // Generate AI summary
            try {
                const aiSummary = await AIService.generateReport(
                    { ...filters, reportType: 'AgentPerformance', data: reportData },
                    'json',
                    new AbortController()
                );
                reportData.aiSummary = aiSummary.summary || 'No AI summary available';
            } catch (error) {
                reportData.aiSummary = 'AI summary unavailable';
            }

            return reportData;
        } catch (error) {
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
        const userRegionWhere = {};

        if (regionalManagerID) userRegionWhere.userID = regionalManagerID;
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
                        ],

                        model: User,
                        through: { model: 'UserRegions', where: userRegionWhere },
                        required: !!regionalManagerID
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
                                t + (b.ReceiptStub?.status === 'collected' ? 1 : 0), 0) || 0), 0), 0);
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

            const reportData = {
                summary: {
                    totalRegions: filteredRegions.length,
                    totalVisits: filteredRegions.reduce((sum, r) =>
                        sum + r.Governorates.reduce((a, g) =>
                            a + g.Delegations.reduce((s, d) => s + (d.Agent?.Visits?.length || 0), 0), 0), 0),
                    totalStubsCollected: filteredRegions.reduce((sum, r) =>
                        sum + r.Governorates.reduce((a, g) =>
                            a + g.Delegations.reduce((s, d) =>
                                s + (d.Agent?.ReceiptBooks?.reduce((t, b) =>
                                    t + (b.ReceiptStub?.status === 'collected' ? 1 : 0), 0) || 0), 0), 0), 0),
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
                        name: r.name || 'N/A',
                        visits: r.Governorates.reduce((sum, g) =>
                            sum + g.Delegations.reduce((s, d) => s + (d.Agent?.Visits?.length || 0), 0), 0),
                        visitsCompleted: r.Governorates.reduce((sum, g) =>
                            sum + g.Delegations.reduce((s, d) =>
                                s + (d.Agent?.Visits?.filter(v => v.status === 'completed').length || 0), 0), 0),
                        stubsCollected: r.Governorates.reduce((sum, g) =>
                            sum + g.Delegations.reduce((s, d) =>
                                s + (d.Agent?.ReceiptBooks?.reduce((t, b) =>
                                    t + (b.ReceiptStub?.status === 'collected' ? 1 : 0), 0) || 0), 0), 0),
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

            // Generate AI summary
            try {
                const aiSummary = await AIService.generateReport(
                    { ...filters, reportType: 'RegionPerformance', data: reportData },
                    'json',
                    new AbortController()
                );
                reportData.aiSummary = aiSummary.summary || 'No AI summary available';
            } catch (error) {
                reportData.aiSummary = 'AI summary unavailable';
            }

            return reportData;
        } catch (error) {
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
            visitReasons
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
                AnomalyReport,
                agentPerformanceReport,
                regionPerformanceReport
            ] = await Promise.all([
                ReportService.generateVisitSummaryReport({ supervisorID, dateRange, regionID, status, visitReasons, agentID }),
                ReportService.generateTimesheetReport({ supervisorID, regionalManagerID, dateRange, status }),
                ReportService.generateReceiptBookInventoryReport({ dateRange, regionID }),
                ReportService.generateStubCollectionReport({ agentID, supervisorID, regionalManagerID, dateRange, status }),
                ReportService.generateUserActivityReport({ dateRange }),
                ReportService.generateAnomalyReport({ dateRange }),
                ReportService.generateAgentPerformanceReport({ supervisorID, regionalManagerID, dateRange, agentID, regionID }),
                ReportService.generateRegionPerformance({ regionalManagerID, dateRange, regionID })
            ]);

            const reportData = {
                visitSummaryReport,
                timesheetReport,
                receiptBookInventoryReport,
                stubCollectionReport,
                userActivityReport,
                AnomalyReport,
                agentPerformanceReport,
                regionPerformanceReport
            };

            // Generate AI summary for Full report
            try {
                const aiSummary = await AIService.generateReport(
                    { ...filters, reportType: 'Full', data: reportData },
                    'json',
                    new AbortController()
                );
                reportData.aiSummary = aiSummary.summary || 'No AI summary available';
            } catch (error) {
                reportData.aiSummary = 'AI summary unavailable';
            }

            return reportData;
        } catch (error) {
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


            return filePath;
        } catch (error) {
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

            writeStream.on('error', (err) => {
                reject(err);
            });

            writeStream.on('finish', () => {
                resolve();
            });

            try {
                doc.registerFont('Roboto-Regular', path.join(__dirname, '../Templates/fonts/Roboto-Regular.ttf'));
                doc.registerFont('Roboto-Bold', path.join(__dirname, '../Templates/fonts/Roboto-Bold.ttf'));

                const logoPath = path.join(__dirname, '../Templates/logo/Logo.png');
                await fs.access(logoPath);
                doc.image(logoPath, 40, 30, { width: 50 });

                doc.font('Roboto-Bold')
                    .fontSize(24)
                    .fillColor('#333333')
                    .text(`TraceFlow ${reportType} Report`, 0, 40, { align: 'center' });
                doc.font('Roboto-Regular')
                    .fontSize(10)
                    .fillColor('#666666')
                    .text(`Generated on ${new Date().toLocaleString()}`, 0, 70, { align: 'center' });

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

                        doc.font('Roboto-Bold')
                            .fontSize(14)
                            .fillColor('#005566')
                            .text('AI-Generated Summary', 20, doc.y, { underline: true });
                        doc.moveDown(0.5);
                        doc.font('Roboto-Regular')
                            .fontSize(11)
                            .fillColor('#333333')
                            .text(data.aiSummary || 'No AI summary available', 30, doc.y, { width: 520, align: 'left' });
                        doc.moveDown(1);

                        if (sectionData.details && sectionData.details.length) {
                            doc.addPage(); // Start table on new page
                            doc.font('Roboto-Bold')
                                .fontSize(14)
                                .fillColor('#005566')
                                .text('Details', 20, 30, { underline: true });
                            const headers = Object.keys(sectionData.details[0]).map(h => h.replace(/([A-Z])/g, ' $1').trim());
                            const tableTop = doc.y + 10;
                            let y = this._drawTable(doc, headers, sectionData.details, tableTop);

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
                    doc.font('Roboto-Bold')
                        .fontSize(14)
                        .fillColor('#005566')
                        .text('AI-Generated Summary', 20, doc.y, { underline: true });
                    doc.moveDown(0.5);
                    doc.font('Roboto-Regular')
                        .fontSize(11)
                        .fillColor('#333333')
                        .text(data.aiSummary || 'No AI summary available', 30, doc.y, { width: 520, align: 'left' });
                    doc.moveDown(1);

                    if (data.details && data.details.length) {
                        doc.addPage(); // Start table on new page
                        doc.font('Roboto-Bold')
                            .fontSize(14)
                            .fillColor('#005566')
                            .text('Details', 20, 30, { underline: true });
                        const headers = Object.keys(data.details[0]).map(h => h.replace(/([A-Z])/g, ' $1').trim());
                        const tableTop = doc.y + 10;
                        let y = this._drawTable(doc, headers, data.details, tableTop);

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

                // Page numbering on content pages
                const pageCount = doc.bufferedPageRange().count;
                for (let i = 0; i < pageCount; i++) {
                    doc.switchToPage(i);
                    doc.font('Roboto-Regular')
                        .fontSize(8)
                        .fillColor('#999999')
                        .text(`Page ${i + 1} of ${pageCount}`, 20, doc.page.height - 50, { align: 'left' });
                }

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    static _drawTable(doc, headers, data, startY) {
        let y = startY;
        const pageWidth = 555; // Total table width
        const margin = 12; // Margin for text spacing
        const minColWidth = 50; // Minimum column width
        const maxColWidth = 150; // Max column width
        const fontSize = 8; // Fixed font size for all text
        const lineHeight = 1.3; // Line height for readability
        const headerPadding = 10; // Padding for header height

        // Custom word wrapping function to prevent mid-word breaks
        const wrapText = (text, maxWidth, font) => {
            doc.font(font).fontSize(fontSize);
            const words = String(text).split(' ');
            let lines = [];
            let currentLine = '';
            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const width = doc.widthOfString(testLine);
                if (width <= maxWidth - 2 * margin) {
                    currentLine = testLine;
                } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word;
                    // Handle very long words (e.g., IDs)
                    if (doc.widthOfString(word) > maxWidth - 2 * margin) {
                        // Truncate long words with ellipsis
                        let truncated = word;
                        while (doc.widthOfString(truncated + '...') > maxWidth - 2 * margin && truncated.length > 1) {
                            truncated = truncated.slice(0, -1);
                        }
                        lines.push(truncated + (truncated.length < word.length ? '...' : ''));
                        currentLine = '';
                    }
                }
            }
            if (currentLine) lines.push(currentLine);
            return lines;
        };

        // Calculate column widths based on longest word, with special handling for "Checklist Completed"
        const calculatedWidths = headers.map((header, i) => {
            const headerKey = header.toLowerCase().replace(/\s/g, '');
            let maxWidth;
            if (headerKey === 'checklistcompleted') {
                // For "Checklist Completed", use width of longest word ("Completed")
                const headerWords = header.split(' ');
                maxWidth = Math.max(
                    ...headerWords.map(word => doc.widthOfString(word, { font: 'Roboto-Bold', fontSize }) + 2 * margin),
                    minColWidth
                );
            } else {
                // Other headers: use longest word in header
                const headerWords = header.split(' ');
                maxWidth = Math.max(
                    ...headerWords.map(word => doc.widthOfString(word, { font: 'Roboto-Bold', fontSize }) + 2 * margin),
                    minColWidth
                );
            }
            // Check data for longest word
            data.forEach(row => {
                const key = headerKey === 'checklistcompleted' ? 'checklistCompleted' : headerKey;
                const value = key === 'checklistCompleted' ? (row[key] ? 'Yes' : 'No') : String(row[key] || 'N/A');
                const words = String(value).split(' ');
                words.forEach(word => {
                    const wordWidth = doc.widthOfString(word, { font: 'Roboto-Regular', fontSize }) + 2 * margin;
                    maxWidth = Math.max(maxWidth, wordWidth);
                });
            });
            return Math.min(maxWidth, maxColWidth);
        });

        // Normalize widths to fit page
        const totalCalculatedWidth = calculatedWidths.reduce((sum, w) => sum + w, 0);
        const adjustedWidths = totalCalculatedWidth > pageWidth
            ? calculatedWidths.map(w => (w / totalCalculatedWidth) * pageWidth)
            : calculatedWidths.map((w, i) => {
                // Constrain "Checklist Completed" to fit "Yes"/"No" with buffer
                if (headers[i].toLowerCase().replace(/\s/g, '') === 'checklistcompleted') {
                    const yesNoWidth = doc.widthOfString('Yes', { font: 'Roboto-Regular', fontSize }) + 2 * margin;
                    return Math.min(w, yesNoWidth * 1.2); // 20% buffer for readability
                }
                return w;
            });

        // Calculate header height based on max number of wrapped lines
        const headerLines = headers.map((header, i) => wrapText(header, adjustedWidths[i], 'Roboto-Bold').length);
        const maxHeaderLines = Math.max(...headerLines, 1);
        const headerHeight = maxHeaderLines * fontSize * lineHeight + headerPadding;

        // Draw header background
        doc.rect(20, y - 8, pageWidth, headerHeight).fill('#F1F5F9').fillColor('#333333');

        // Draw headers
        doc.font('Roboto-Bold').fontSize(fontSize);
        headers.forEach((header, i) => {
            const x = 20 + adjustedWidths.slice(0, i).reduce((sum, w) => sum + w, 0);
            const lines = wrapText(header, adjustedWidths[i], 'Roboto-Bold');
            let lineY = y + 4;
            lines.forEach(line => {
                doc.text(line, x + margin, lineY, {
                    width: adjustedWidths[i] - 2 * margin,
                    align: 'left'
                });
                lineY += fontSize * lineHeight;
            });
        });
        y += headerHeight;

        // Draw data rows
        data.forEach((row, rowIndex) => {
            const rowHeight = Math.max(
                ...headers.map((_, i) => {
                    const headerKey = headers[i].toLowerCase().replace(/\s/g, '');
                    const key = headerKey === 'checklistcompleted' ? 'checklistCompleted' : headerKey;
                    const value = key === 'checklistCompleted' ? (row[key] ? 'Yes' : 'No') : String(row[key] || 'N/A');
                    const lines = wrapText(value, adjustedWidths[i], 'Roboto-Regular');
                    return lines.length * fontSize * lineHeight + 10;
                }),
                20 // Minimum row height
            );

            if (y + rowHeight > doc.page.height - 60) {
                doc.addPage();
                y = 30;
                doc.rect(20, y - 8, pageWidth, headerHeight).fill('#F1F5F9').fillColor('#333333');
                doc.font('Roboto-Bold').fontSize(fontSize);
                headers.forEach((header, i) => {
                    const x = 20 + adjustedWidths.slice(0, i).reduce((sum, w) => sum + w, 0);
                    const lines = wrapText(header, adjustedWidths[i], 'Roboto-Bold');
                    let lineY = y + 4;
                    lines.forEach(line => {
                        doc.text(line, x + margin, lineY, {
                            width: adjustedWidths[i] - 2 * margin,
                            align: 'left'
                        });
                        lineY += fontSize * lineHeight;
                    });
                });
                y += headerHeight;
            }

            if (rowIndex % 2 === 0) {
                doc.rect(20, y - 5, pageWidth, rowHeight).fill('#F8FAFC').fillColor('#333333');
            }

            doc.font('Roboto-Regular').fontSize(fontSize);
            headers.forEach((header, i) => {
                const headerKey = header.toLowerCase().replace(/\s/g, '');
                const key = headerKey === 'checklistcompleted' ? 'checklistCompleted' : headerKey;
                const text = key === 'checklistCompleted' ? (row[key] ? 'Yes' : 'No') : String(row[key] || 'N/A');
                const x = 20 + adjustedWidths.slice(0, i).reduce((sum, w) => sum + w, 0);
                const lines = wrapText(text, adjustedWidths[i], 'Roboto-Regular');
                let lineY = y + 4;
                lines.forEach(line => {
                    doc.text(line, x + margin, lineY, {
                        width: adjustedWidths[i] - 2 * margin,
                        align: 'left'
                    });
                    lineY += fontSize * lineHeight;
                });
            });

            y += rowHeight;
        });

        // Draw table boundaries
        doc.moveTo(20, startY - 8)
            .lineTo(20 + pageWidth, startY - 8)
            .strokeColor('#E2E8F0')
            .lineWidth(0.5)
            .stroke();
        doc.moveTo(20, y)
            .lineTo(20 + pageWidth, y)
            .strokeColor('#E2E8F0')
            .lineWidth(0.5)
            .stroke();

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
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8ECEF' } },
            alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
            border: {
                top: { style: 'thin', color: { argb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                left: { style: 'thin', color: { argb: 'E2E8F0' } },
                right: { style: 'thin', color: { argb: 'E2E8F0' } },
            },
        };
        const cellStyle = {
            font: { name: 'Arial', size: 10, color: { argb: '333333' } },
            alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
            border: {
                top: { style: 'thin', color: { argb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                left: { style: 'thin', color: { argb: 'E2E8F0' } },
                right: { style: 'thin', color: { argb: 'E2E8F0' } },
            },
        };
        const titleStyle = {
            font: { name: 'Arial', size: 14, bold: true, color: { argb: '333333' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
        };
        const footerStyle = {
            font: { name: 'Arial', size: 8, color: { argb: '666666' } },
            alignment: { horizontal: 'left', vertical: 'middle' },
        };

        try {
            if (reportType === 'Full') {
                for (const [section, sectionData] of Object.entries(data)) {
                    // Skip aiSummary for sheet generation
                    if (section === 'aiSummary') continue;

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

                    const aiSummaryRow = summarySheet.getRow(rowIndex + 1);
                    aiSummaryRow.getCell(1).value = 'AI-Generated Summary';
                    aiSummaryRow.getCell(1).style = headerStyle;
                    aiSummaryRow.getCell(2).value = sectionData.aiSummary || 'No AI summary available';
                    aiSummaryRow.getCell(2).style = cellStyle;
                    rowIndex += 2;

                    summarySheet.columns = [{ width: 30 }, { width: 50 }];

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
                                const headerKey = header.toLowerCase().replace(/\s/g, '');
                                const key = headerKey === 'checklistcompleted' ? 'checklistCompleted' : headerKey;
                                const value = key === 'checklistCompleted' ? (rowData[key] ? 'Yes' : 'No') : String(rowData[key] || 'N/A');
                                row.getCell(j + 1).value = value;
                                row.getCell(j + 1).style = cellStyle;
                            });
                        });

                        detailSheet.getRow(sectionData.details.length + 5).getCell(1).value = `Generated at: ${new Date().toLocaleString()}`;
                        detailSheet.getRow(sectionData.details.length + 5).getCell(1).style = footerStyle;

                        // Set dynamic column widths based on content
                        detailSheet.columns = headers.map((header, i) => {
                            let maxWidth = header.length;
                            sectionData.details.forEach(row => {
                                const headerKey = header.toLowerCase().replace(/\s/g, '');
                                const key = headerKey === 'checklistcompleted' ? 'checklistCompleted' : headerKey;
                                const value = key === 'checklistCompleted' ? (row[key] ? 'Yes' : 'No') : String(row[key] || 'N/A');
                                maxWidth = Math.max(maxWidth, value.length);
                            });
                            return { width: Math.min(Math.max(maxWidth, 10), 50) };
                        });
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

                const aiSummaryRow = summarySheet.getRow(rowIndex + 1);
                aiSummaryRow.getCell(1).value = 'AI-Generated Summary';
                aiSummaryRow.getCell(1).style = headerStyle;
                aiSummaryRow.getCell(2).value = data.aiSummary || 'No AI summary available';
                aiSummaryRow.getCell(2).style = cellStyle;
                rowIndex += 2;

                summarySheet.columns = [{ width: 30 }, { width: 50 }];

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
                            const headerKey = header.toLowerCase().replace(/\s/g, '');
                            const key = headerKey === 'checklistcompleted' ? 'checklistCompleted' : headerKey;
                            const value = key === 'checklistCompleted' ? (rowData[key] ? 'Yes' : 'No') : String(rowData[key] || 'N/A');
                            row.getCell(j + 1).value = value;
                            row.getCell(j + 1).style = cellStyle;
                        });
                    });

                    detailSheet.getRow(data.details.length + 5).getCell(1).value = `Generated at: ${new Date().toLocaleString()}`;
                    detailSheet.getRow(data.details.length + 5).getCell(1).style = footerStyle;

                    // Set dynamic column widths based on content
                    detailSheet.columns = headers.map((header, i) => {
                        let maxWidth = header.length;
                        data.details.forEach(row => {
                            const headerKey = header.toLowerCase().replace(/\s/g, '');
                            const key = headerKey === 'checklistcompleted' ? 'checklistCompleted' : headerKey;
                            const value = key === 'checklistCompleted' ? (row[key] ? 'Yes' : 'No') : String(row[key] || 'N/A');
                            maxWidth = Math.max(maxWidth, value.length);
                        });
                        return { width: Math.min(Math.max(maxWidth, 10), 50) };
                    });
                }
            }

            await workbook.xlsx.writeFile(filePath);
        } catch (error) {
            throw new Error(`Failed to generate Excel report: ${error.message}`);
        }
    }


}

module.exports = ReportService;