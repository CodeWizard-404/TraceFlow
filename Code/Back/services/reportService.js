const PDFDocument = require('pdfkit');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { Visit, Role, Timesheet, ReceiptBook, ReceiptStub, User, Log, Agent, Region, Delegation, ReceiptBookType } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class ReportService {
    static async generateVisitSummaryReport(filters) {
        const { supervisorID, dateRange, regionID, agentID, status } = filters;
        const where = {};
        const agentWhere = {};
        if (dateRange) where.date = { [Op.between]: [dateRange.start, dateRange.end] };
        if (regionID) agentWhere['$Delegation.Region.regionID$'] = regionID;
        if (agentID) where.agentID = agentID;
        if (status) where.status = status;
        if (supervisorID) agentWhere.supervisorID = supervisorID;

        try {
            // Debug: Check if Agent-Visit association exists
            const associations = Visit.associations;
            if (!associations.Agent) {
                logger.error('Agent-Visit association not found', { metadata: { associations: Object.keys(associations) } });
                throw new Error('Agent-Visit association not registered');
            }

            const visits = await Visit.findAll({
                where,
                include: [{
                    model: Agent,
                    where: agentWhere,
                    required: false,
                    include: [{
                        model: Delegation,
                        include: [{ model: Region }],
                        required: false,
                    }],
                }],
            });

            const totalVisits = visits.length;
            const completedVisits = visits.filter(v => v.status === 'completed').length;
            const pendingVisits = totalVisits - completedVisits;
            const averageDuration = visits.length ? visits.reduce((sum, v) => sum + (v.duration || 0), 0) / visits.length : 0;

            return {
                summary: {
                    totalVisits,
                    completedVisits,
                    pendingVisits,
                    averageDuration: averageDuration.toFixed(2),
                },
                details: visits.map(v => ({
                    id: v.visitID,
                    date: v.date,
                    location: v.location || 'N/A',
                    status: v.status,
                    agent: v.Agent ? `${v.Agent.name} ${v.Agent.lastname}` : 'Unassigned',
                    region: v.Agent?.Delegation?.Region?.name || 'N/A',
                })),
            };
        } catch (error) {
            logger.error(`Failed to generate VisitSummary report: ${error.message}`, { error });
            throw error;
        }
    }

    static async generateTimesheetReport(filters) {
        const { supervisorID, regionalManagerID, dateRange, status } = filters;
        const where = {};
        const userWhere = {};
        if (supervisorID) where.supervisorID = supervisorID;
        if (regionalManagerID) userWhere.regionalManagerID = regionalManagerID;
        if (dateRange) where.createdAt = { [Op.between]: [dateRange.start, dateRange.end] };
        if (status) where.status = status;

        try {
            const timesheets = await Timesheet.findAll({
                where,
                include: [
                    { model: User, where: userWhere, required: false },
                    { model: Visit, required: false },
                ],
            });

            return {
                summary: {
                    totalTimesheets: timesheets.length,
                    totalHours: timesheets.reduce((sum, t) => sum + t.Visits.reduce((s, v) => s + (v.duration || 0), 0), 0) / 60,
                },
                details: timesheets.map(t => ({
                    id: t.timesheetID,
                    supervisor: t.User ? `${t.User.firstname} ${t.User.lastname}` : 'N/A',
                    week: `${t.weekNumber}/${t.year}`,
                    status: t.status,
                    totalHours: (t.Visits.reduce((sum, v) => sum + (v.duration || 0), 0) / 60).toFixed(2),
                    anomalies: t.status === 'anomaly' ? 'Detected' : 'None',
                })),
            };
        } catch (error) {
            logger.error(`Failed to generate Timesheet report: ${error.message}`, { error });
            throw error;
        }
    }

    static async generateReceiptBookInventoryReport(filters) {
        const { dateRange, regionID, bookType, status } = filters;
        const where = {};
        const agentWhere = {};
        if (dateRange) where.createdAt = { [Op.between]: [dateRange.start, dateRange.end] };
        if (regionID) agentWhere['$Delegation.Region.regionID$'] = regionID;
        if (bookType) where.typeID = bookType;
        if (status) where.status = status;

        try {
            const receiptBooks = await ReceiptBook.findAll({
                where,
                include: [
                    {
                        model: Agent,
                        where: agentWhere,
                        include: [{ model: Delegation, include: [Region], required: false }],
                        required: false,
                    },
                    { model: ReceiptBookType, required: false },
                ],
            });

            return {
                summary: {
                    totalBooks: receiptBooks.length,
                    inStock: receiptBooks.filter(b => b.status === 'In Stock').length,
                    distributed: receiptBooks.filter(b => b.status === 'Assigned to Agent').length,
                    returned: receiptBooks.filter(b => b.status === 'Stub Collected').length,
                },
                details: receiptBooks.map(b => ({
                    id: b.bookID,
                    number: b.number,
                    status: b.status,
                    type: b.ReceiptBookType?.name || 'N/A',
                    region: b.Agent?.Delegation?.Region?.name || 'N/A',
                })),
            };
        } catch (error) {
            logger.error(`Failed to generate ReceiptBookInventory report: ${error.message}`, { error });
            throw error;
        }
    }

    static async generateStubCollectionReport(filters) {
        const { agentID, supervisorID, regionalManagerID, dateRange, status } = filters;
        const where = {};
        const bookWhere = {};
        const userWhere = {};
        if (agentID) bookWhere.agentID = agentID;
        if (supervisorID) bookWhere.currentHolderID = supervisorID;
        if (regionalManagerID) userWhere.regionalManagerID = regionalManagerID;
        if (dateRange) where.createdAt = { [Op.between]: [dateRange.start, dateRange.end] };
        if (status) where.status = status;

        try {
            const stubs = await ReceiptStub.findAll({
                where,
                include: [{
                    model: ReceiptBook,
                    where: bookWhere,
                    include: [
                        { model: User, as: 'CurrentHolder', where: userWhere, required: false },
                        { model: Agent, required: false },
                    ],
                }],
            });

            return {
                summary: {
                    totalStubs: stubs.length,
                    collected: stubs.filter(s => s.status === 'collected').length,
                    pending: stubs.filter(s => s.status === 'pending').length,
                    archived: stubs.filter(s => s.status === 'archived').length,
                },
                details: stubs.map(s => ({
                    id: s.stubID,
                    bookNumber: s.ReceiptBook?.number || 'N/A',
                    status: s.status,
                    agent: s.ReceiptBook?.Agent ? `${s.ReceiptBook.Agent.name} ${s.ReceiptBook.Agent.lastname}` : 'N/A',
                    supervisor: s.ReceiptBook?.CurrentHolder ? `${s.ReceiptBook.CurrentHolder.firstname} ${s.ReceiptBook.CurrentHolder.lastname}` : 'N/A',
                })),
            };
        } catch (error) {
            logger.error(`Failed to generate StubCollection report: ${error.message}`, { error });
            throw error;
        }
    }

    static async generateUserActivityReport(filters) {
        const { roleID, dateRange, activityType } = filters;
        const where = {};
        const roleWhere = {};
        if (dateRange) where.timestamp = { [Op.between]: [dateRange.start, dateRange.end] };
        if (activityType) where.route = activityType;
        if (roleID) roleWhere.roleID = roleID;

        try {
            const logs = await Log.findAll({
                where,
                include: [{
                    model: User,
                    include: [{ model: Role, where: roleWhere, required: false }],
                    required: false,
                }],
            });

            return {
                summary: {
                    totalLogins: logs.filter(l => l.route === '/api/auth/login').length,
                    lastActive: logs.length ? new Date(Math.max(...logs.map(l => new Date(l.timestamp).getTime()))).toISOString() : 'N/A',
                },
                details: logs.map(l => ({
                    user: l.User ? `${l.User.firstname} ${l.User.lastname}` : 'N/A',
                    role: l.User?.Roles[0]?.name || 'N/A',
                    activity: l.route,
                    timestamp: l.timestamp,
                    suspicious: l.level === 'warn' || l.level === 'error' ? 'Yes' : 'No',
                })),
            };
        } catch (error) {
            logger.error(`Failed to generate UserActivity report: ${error.message}`, { error });
            throw error;
        }
    }

    static async generateAIAnomalyReport(filters) {
        const { dateRange, anomalyType, roleID } = filters;
        const where = { level: 'warn' };
        const roleWhere = {};
        if (dateRange) where.timestamp = { [Op.between]: [dateRange.start, dateRange.end] };
        if (anomalyType) where.message = { [Op.like]: `%${anomalyType}%` };
        if (roleID) where.roleID = roleID;

        try {
            const logs = await Log.findAll({
                where,
                include: [{
                    model: User,
                    include: [{ model: Role, where: roleWhere, required: false }],
                    required: false,
                }],
            });

            return {
                summary: { totalAnomalies: logs.length },
                details: logs.map(l => ({
                    id: l.logID,
                    user: l.User ? `${l.User.firstname} ${l.User.lastname}` : 'N/A',
                    anomaly: l.message || 'N/A',
                    affected: l.route.includes('timesheet') ? 'Timesheet' : l.route.includes('visit') ? 'Visit' : 'Other',
                    status: 'Pending',
                })),
            };
        } catch (error) {
            logger.error(`Failed to generate AIAnomaly report: ${error.message}`, { error });
            throw error;
        }
    }

    static async generateAgentPerformanceReport(filters) {
        const { supervisorID, regionalManagerID, dateRange, agentID } = filters;
        const where = {};
        const visitWhere = {};
        const delegationWhere = {};
        if (supervisorID) where.supervisorID = supervisorID;
        if (regionalManagerID) delegationWhere['$Region.regionalManagerID$'] = regionalManagerID;
        if (dateRange) visitWhere.date = { [Op.between]: [dateRange.start, dateRange.end] };
        if (agentID) where.agentID = agentID;

        try {
            const agents = await Agent.findAll({
                where,
                include: [
                    { model: Visit, where: visitWhere, required: false },
                    { model: ReceiptBook, include: [{ model: ReceiptStub, required: false }], required: false },
                    { model: Delegation, where: delegationWhere, include: [Region], required: false },
                ],
            });

            return {
                summary: {
                    totalAgents: agents.length,
                    totalVisits: agents.reduce((sum, a) => sum + a.Visits.length, 0),
                    totalStubs: agents.reduce((sum, a) => sum + a.ReceiptBooks.reduce((s, b) => s + (b.ReceiptStub ? 1 : 0), 0), 0),
                },
                details: agents.map(a => ({
                    id: a.agentID,
                    name: `${a.name} ${a.lastname}`,
                    visitsCompleted: a.Visits.filter(v => v.status === 'completed').length,
                    stubsCollected: a.ReceiptBooks.reduce((sum, b) => sum + (b.ReceiptStub?.status === 'collected' ? 1 : 0), 0),
                    region: a.Delegation?.Region?.name || 'N/A',
                    performanceScore: ((a.Visits.filter(v => v.status === 'completed').length / (a.Visits.length || 1)) * 100).toFixed(1),
                })),
            };
        } catch (error) {
            logger.error(`Failed to generate AgentPerformance report: ${error.message}`, { error });
            throw error;
        }
    }

    static async generateRegionPerformanceReport(filters) {
        const { regionalManagerID, dateRange, regionID } = filters;
        const where = {};
        const visitWhere = {};
        if (regionalManagerID) where.regionalManagerID = regionalManagerID;
        if (dateRange) visitWhere.date = { [Op.between]: [dateRange.start, dateRange.end] };
        if (regionID) where.regionID = regionID;

        try {
            const regions = await Region.findAll({
                where,
                include: [{
                    model: Delegation,
                    include: [{
                        model: Agent,
                        include: [
                            { model: Visit, where: visitWhere, required: false },
                            { model: ReceiptBook, include: [{ model: ReceiptStub, required: false }], required: false },
                        ],
                        required: false,
                    }],
                    required: false,
                }],
            });

            return {
                summary: {
                    totalRegions: regions.length,
                    totalVisits: regions.reduce((sum, r) => sum + r.Delegations.reduce((s, d) => s + (d.Agent?.Visits.length || 0), 0), 0),
                    totalStubs: regions.reduce((sum, r) => sum + r.Delegations.reduce((s, d) => s + (d.Agent?.ReceiptBooks.reduce((t, b) => t + (b.ReceiptStub ? 1 : 0), 0) || 0), 0), 0),
                },
                details: regions.map(r => ({
                    id: r.regionID,
                    name: r.name || 'N/A',
                    visitsCompleted: r.Delegations.reduce((sum, d) => sum + (d.Agent?.Visits.filter(v => v.status === 'completed').length || 0), 0),
                    stubsCollected: r.Delegations.reduce((sum, d) => sum + (d.Agent?.ReceiptBooks.reduce((s, b) => s + (b?.ReceiptStub?.status === 'collected' ? 1 : 0), 0) || 0), 0),
                    performanceScore: ((r.Delegations.reduce((sum, d) => sum + (d.Agent?.Visits.filter(v => v.status === 'completed').length || 0), 0) / (r.Delegations.reduce((sum, d) => sum + (d?.Agent?.Visits.length || 0), 0) || 1)) * 100).toFixed(1),
                })),
            };
        } catch (error) {
            logger.error(`Failed to generate RegionPerformance report: ${error.message}`, { error });
            throw error;
        }
    }

    static async generateFullReport(filters) {
        const { supervisorID, regionalManagerID, dateRange, regionID } = filters;
        if (!supervisorID && !regionalManagerID) {
            throw new Error('Either supervisorID or regionalManagerID is required');
        }

        try {
            const visitSummary = await this.generateVisitSummaryReport({ supervisorID, dateRange, regionID });
            const timesheet = await this.generateTimesheetReport({ supervisorID, regionalManagerID, dateRange });
            const receiptBookInventory = await this.generateReceiptBookInventoryReport({ dateRange, regionID });
            const stubCollection = await this.generateStubCollectionReport({ supervisorID, regionalManagerID, dateRange });
            const userActivity = await this.generateUserActivityReport({ dateRange });
            const aiAnomaly = await this.generateAIAnomalyReport({ dateRange });
            const agentPerformance = await this.generateAgentPerformanceReport({ supervisorID, regionalManagerID, dateRange, regionID });
            const regionPerformance = await this.generateRegionPerformanceReport({ regionalManagerID, dateRange, regionID });

            return {
                visitSummary,
                timesheet,
                receiptBookInventory,
                stubCollection,
                userActivity,
                aiAnomaly,
                agentPerformance,
                regionPerformance,
            };
        } catch (error) {
            logger.error(`Failed to generate Full report: ${error.message}`, { error });
            throw error;
        }
    }

    static async exportReport(reportType, data, format) {
        const reportName = `${reportType}_${Date.now()}`;
        const filePath = path.join(__dirname, '../reports', `${reportName}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);

        try {
            if (!fs.existsSync(path.dirname(filePath))) {
                fs.mkdirSync(path.dirname(filePath), { recursive: true });
            }

            if (format === 'pdf') {
                await this.generatePDF(data, reportType, filePath);
            } else if (format === 'excel') {
                await this.generateExcel(data, reportType, filePath);
            }

            return filePath;
        } catch (error) {
            logger.error(`Failed to export report: ${error.message}`, { error });
            throw error;
        }
    }

    static async generatePDF(data, reportType, filePath) {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        doc.pipe(fs.createWriteStream(filePath));

        // Add Logo
        const logoPath = path.join(__dirname, '../emailTemplates/logo/Logo.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 50, { width: 100 });
        }

        doc.fontSize(20).text(`TraceFlow ${reportType} Report`, 200, 60, { align: 'center' });
        doc.moveDown();

        if (reportType === 'Full') {
            for (const [section, sectionData] of Object.entries(data)) {
                doc.addPage();
                doc.fontSize(16).text(section.replace(/([A-Z])/g, ' $1').trim(), { underline: true });
                doc.moveDown();

                // Summary
                doc.fontSize(14).text('Summary', { underline: true });
                doc.fontSize(12);
                for (const [key, value] of Object.entries(sectionData.summary)) {
                    doc.text(`${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}`);
                }
                doc.moveDown();

                // Details
                if (sectionData.details && sectionData.details.length) {
                    doc.fontSize(14).text('Details', { underline: true });
                    const tableTop = doc.y + 10;
                    const headers = Object.keys(sectionData.details[0]);
                    const colWidth = 500 / headers.length;

                    // Headers
                    doc.fontSize(10).font('Helvetica-Bold');
                    headers.forEach((header, i) => {
                        doc.text(header.replace(/([A-Z])/g, ' $1').trim(), 50 + i * colWidth, tableTop, { width: colWidth - 10, align: 'left' });
                    });

                    // Rows
                    doc.font('Helvetica');
                    sectionData.details.forEach((row, rowIndex) => {
                        const y = tableTop + 20 + rowIndex * 20;
                        headers.forEach((header, colIndex) => {
                            doc.text(String(row[header] || 'N/A'), 50 + colIndex * colWidth, y, { width: colWidth - 10, align: 'left' });
                        });
                    });
                }
            }
        } else {
            // Summary
            doc.fontSize(14).text('Summary', { underline: true });
            doc.fontSize(12);
            for (const [key, value] of Object.entries(data.summary)) {
                doc.text(`${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}`);
            }
            doc.moveDown();

            // Details
            if (data.details && data.details.length) {
                doc.fontSize(14).text('Details', { underline: true });
                const tableTop = doc.y + 10;
                const headers = Object.keys(data.details[0]);
                const colWidth = 500 / headers.length;

                // Headers
                doc.fontSize(10).font('Helvetica-Bold');
                headers.forEach((header, i) => {
                    doc.text(header.replace(/([A-Z])/g, ' $1').trim(), 50 + i * colWidth, tableTop, { width: colWidth - 10, align: 'left' });
                });

                // Rows
                doc.font('Helvetica');
                data.details.forEach((row, rowIndex) => {
                    const y = tableTop + 20 + rowIndex * 20;
                    headers.forEach((header, colIndex) => {
                        doc.text(String(row[header] || 'N/A'), 50 + colIndex * colWidth, y, { width: colWidth - 10, align: 'left' });
                    });
                });
            }
        }

        doc.end();
    }

    static async generateExcel(data, reportType, filePath) {
        const workbook = xlsx.utils.book_new();

        if (reportType === 'Full') {
            for (const [section, sectionData] of Object.entries(data)) {
                // Summary Sheet
                const summaryData = Object.entries(sectionData.summary).map(([key, value]) => [key.replace(/([A-Z])/g, ' $1').trim(), value]);
                const summarySheet = xlsx.utils.aoa_to_sheet([[section.replace(/([A-Z])/g, ' $1').trim() + ' Summary'], ...summaryData]);
                xlsx.utils.book_append_sheet(workbook, summarySheet, `${section}_Summary`.slice(0, 31));

                // Details Sheet
                if (sectionData.details && sectionData.details.length) {
                    const detailsSheet = xlsx.utils.json_to_sheet(sectionData.details);
                    xlsx.utils.book_append_sheet(workbook, detailsSheet, `${section}_Details`.slice(0, 31));
                }
            }
        } else {
            // Summary Sheet
            const summaryData = Object.entries(data.summary).map(([key, value]) => [key.replace(/([A-Z])/g, ' $1').trim(), value]);
            const summarySheet = xlsx.utils.aoa_to_sheet([['Summary'], ...summaryData]);
            xlsx.utils.book_append_sheet(workbook, summarySheet, 'Summary');

            // Details Sheet
            if (data.details && data.details.length) {
                const detailsSheet = xlsx.utils.json_to_sheet(data.details);
                xlsx.utils.book_append_sheet(workbook, detailsSheet, 'Details');
            }
        }

        xlsx.writeFile(workbook, filePath);
    }
}

module.exports = ReportService;