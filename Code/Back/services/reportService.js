const PDFDocument = require('pdfkit');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const {
    Visit,
    Role,
    Timesheet,
    ReceiptBook,
    ReceiptStub,
    User,
    Log,
    Agent,
    Region,
    Delegation,
    Governorate,
    ReceiptBookType,
    ReceiptBookTransfer,
    Reason
} = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class ReportService {
    static async generateVisitSummaryReport(filters) {
        const { supervisorID, dateRange, regionID, agentID, status } = filters;
        const where = {};
        if (dateRange) where.date = { [Op.between]: [dateRange.start, dateRange.end] };
        if (agentID) where.agentID = agentID;
        if (status) where.status = status;

        try {
            const visits = await Visit.findAll({
                where,
                include: [
                    {
                        model: Agent,
                        where: supervisorID ? { supervisorID } : {},
                        required: false,
                        include: [
                            {
                                model: Delegation,
                                required: false,
                                include: [
                                    {
                                        model: Governorate,
                                        required: false,
                                        include: [{ model: Region, required: false, where: regionID ? { regionID } : {} }],
                                    },
                                ],
                            },
                        ],
                    },
                    { model: Timesheet, include: [{ model: User }], required: false }, // Removed 'as: Supervisor'
                ],
            });

            const totalVisits = visits.length;
            const validatedVisits = visits.filter((v) => v.status === 'validated').length;
            const pendingVisits = visits.filter((v) => v.status === 'pending').length;
            const averageDuration =
                visits.length > 0
                    ? visits.reduce((sum, v) => sum + (v.duration || 0), 0) / visits.length / 60
                    : 0;

            return {
                summary: {
                    totalVisits,
                    validatedVisits,
                    pendingVisits,
                    averageDuration: averageDuration.toFixed(2),
                },
                details: visits.map((v) => ({
                    id: v.visitID,
                    date: v.date,
                    location: v.location || 'N/A',
                    status: v.status,
                    agent: v.Agent ? `${v.Agent.name} ${v.Agent.lastname}` : 'No Agent',
                    supervisor: v.Timesheet?.User
                        ? `${v.Timesheet.User.firstname} ${v.Timesheet.User.lastname}`
                        : 'N/A',
                    region: v.Agent?.Delegation?.Governorate?.Region?.name || 'N/A',
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
                    {
                        model: User, // Removed 'as: Supervisor'
                        where: userWhere,
                        required: false,
                    },
                    {
                        model: Visit,
                        required: false,
                        include: [{ model: Agent }, { model: Reason }],
                    },
                ],
            });

            return {
                summary: {
                    totalTimesheets: timesheets.length,
                    totalHours: timesheets
                        .reduce((sum, t) => sum + t.Visits.reduce((s, v) => s + (v.duration || 0), 0), 0)
                        / 60,
                    validatedTimesheets: timesheets.filter((t) => t.status === 'validated').length,
                },
                details: timesheets.map((t) => ({
                    id: t.timesheetID,
                    supervisor: t.User
                        ? `${t.User.firstname} ${t.User.lastname}`
                        : 'N/A',
                    week: `${t.weekNumber}/${t.year}`,
                    status: t.status,
                    totalHours: (t.Visits.reduce((sum, v) => sum + (v.duration || 0), 0) / 60).toFixed(2),
                    visitReasons: t.Visits.map((v) => v.Reasons?.map((r) => r.name).join(', ') || 'N/A'),
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
        if (regionID) agentWhere['$Delegation.Governorate.Region.regionID$'] = regionID;
        if (bookType) where.typeID = bookType;
        if (status) where.status = status;

        try {
            const receiptBooks = await ReceiptBook.findAll({
                where,
                include: [
                    {
                        model: Agent,
                        where: agentWhere,
                        include: [
                            {
                                model: Delegation,
                                include: [{ model: Governorate, include: [Region] }],
                            },
                        ],
                        required: false,
                    },
                    { model: ReceiptBookType, required: false },
                    { model: User, as: 'CurrentHolder', required: false },
                ],
            });

            return {
                summary: {
                    totalBooks: receiptBooks.length,
                    inStock: receiptBooks.filter((b) => b.status === 'In Stock').length,
                    withAgents: receiptBooks.filter((b) => b.status === 'Assigned to Agent').length,
                    archived: receiptBooks.filter((b) => b.status === 'Archived').length,
                },
                details: receiptBooks.map((b) => ({
                    id: b.bookID,
                    number: b.number,
                    status: b.status,
                    type: b.ReceiptBookType?.name || 'N/A',
                    region: b.Agent?.Delegation?.Governorate?.Region?.name || 'N/A',
                    currentHolder: b.CurrentHolder
                        ? `${b.CurrentHolder.firstname} ${b.CurrentHolder.lastname}`
                        : b.Agent
                            ? `${b.Agent.name} ${b.Agent.lastname}`
                            : 'N/A',
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
                include: [
                    {
                        model: ReceiptBook,
                        where: bookWhere,
                        include: [
                            { model: User, as: 'CurrentHolder', where: userWhere, required: false },
                            { model: Agent, required: false },
                        ],
                    },
                ],
            });

            return {
                summary: {
                    status: stubs.length,
                    collected: stubs.filter((s) => s.status === 'collected').length,
                    transmitted: stubs.filter((t) => t.status === 'transmitted').length,
                    archived: stubs.filter((s) => s.status === 'archived').length,
                },
                details: stubs.map((s) => ({
                    id: s.stubID,
                    bookNumber: s.ReceiptBook?.number || 'N/A',
                    status: s.status,
                    agent: s.ReceiptBook?.Agent
                        ? `${s.ReceiptBook.Agent.name} ${s.ReceiptBook.Agent.lastname}`
                        : 'N/A',
                    currentHolder: s.ReceiptBook?.CurrentHolder
                        ? `${s.ReceiptBook.CurrentHolder.firstname} ${s.ReceiptBook.CurrentHolder.lastname}`
                        : 'N/A',
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
        if (activityType) where.route = { [Op.like]: `%${activityType}%` };
        if (roleID) roleWhere.roleID = roleID;

        try {
            // Fetch logs without including User
            const logs = await Log.findAll({ where });

            // Get unique user IDs from logs
            const userIds = [...new Set(logs.map((l) => l.userId).filter((id) => id))];

            // Fetch users and their roles
            const users = await User.findAll({
                where: { userID: { [Op.in]: userIds } },
                include: [
                    {
                        model: Role,
                        where: roleWhere,
                        required: !!roleID, // Only require Role if roleID is provided
                        through: { attributes: [] }, // Exclude join table attributes
                    },
                ],
            });

            // Create a user lookup map
            const userMap = users.reduce((map, user) => {
                map[user.userID] = {
                    firstname: user.firstname,
                    lastname: user.lastname,
                    role: user.Roles?.[0]?.name || 'N/A',
                };
                return map;
            }, {});

            return {
                summary: {
                    totalActivities: logs.length,
                    uniqueUsers: userIds.length,
                    lastActivity: logs.length
                        ? new Date(Math.max(...logs.map((l) => new Date(l.timestamp).getTime()))).toISOString()
                        : 'N/A',
                },
                details: logs.map((l) => ({
                    user: l.userId && userMap[l.userId]
                        ? `${userMap[l.userId].firstname} ${userMap[l.userId].lastname}`
                        : 'N/A',
                    role: l.userId && userMap[l.userId] ? userMap[l.userId].role : 'N/A',
                    activity: l.route,
                    timestamp: l.timestamp,
                    status: l.status || 'N/A',
                    suspicious: ['warn', 'error'].includes(l.level) ? 'Yes' : 'No',
                })),
            };
        } catch (error) {
            logger.error(`Failed to generate UserActivity report: ${error.message}`, { error });
            throw error;
        }
    }

    static async generateAIAnomalyReport(filters) {
        const { dateRange, anomalyType, roleID } = filters;
        const where = { level: ['warn', 'error'] };
        const roleWhere = {};
        if (dateRange) where.timestamp = { [Op.between]: [dateRange.start, dateRange.end] };
        if (anomalyType) where.message = { [Op.like]: `%${anomalyType}%` };
        if (roleID) roleWhere.roleID = roleID;

        try {
            // Fetch logs without including User
            const logs = await Log.findAll({ where });

            // Get unique user IDs from logs
            const userIds = [...new Set(logs.map((l) => l.userId).filter((id) => id))];

            // Fetch users and their roles
            const users = await User.findAll({
                where: { userID: { [Op.in]: userIds } },
                include: [
                    {
                        model: Role,
                        where: roleWhere,
                        required: !!roleID, // Only require Role if roleID is provided
                        through: { attributes: [] }, // Exclude join table attributes
                    },
                ],
            });

            // Create a user lookup map
            const userMap = users.reduce((map, user) => {
                map[user.userID] = {
                    firstname: user.firstname,
                    lastname: user.lastname,
                    role: user.Roles?.[0]?.name || 'N/A',
                };
                return map;
            }, {});

            return {
                summary: { totalAnomalies: logs.length },
                details: logs.map((l) => ({
                    id: l.logID,
                    user: l.userId && userMap[l.userId]
                        ? `${userMap[l.userId].firstname} ${userMap[l.userId].lastname}`
                        : 'N/A',
                    role: l.userId && userMap[l.userId] ? userMap[l.userId].role : 'N/A',
                    anomaly: l.message || 'N/A',
                    affected: l.route.includes('timesheet')
                        ? 'Timesheet'
                        : l.route.includes('visit')
                            ? 'Visit'
                            : 'Other',
                    timestamp: l.timestamp,
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
        if (regionalManagerID) delegationWhere['$Governorate.Region.regionalManagerID$'] = regionalManagerID;
        if (dateRange) visitWhere.date = { [Op.between]: [dateRange.start, dateRange.end] };
        if (agentID) where.agentID = agentID;

        try {
            const agents = await Agent.findAll({
                where,
                include: [
                    { model: Visit, where: visitWhere, required: false },
                    {
                        model: ReceiptBook,
                        include: [{ model: ReceiptStub, required: false }],
                        required: false,
                    },
                    {
                        model: Delegation,
                        where: delegationWhere,
                        include: [{ model: Governorate, include: [Region] }],
                        required: false,
                    },
                ],
            });

            return {
                summary: {
                    totalAgents: agents.length,
                    totalVisits: agents.reduce((sum, a) => sum + a.Visits.length, 0),
                    totalStubsCollected: agents.reduce(
                        (sum, a) =>
                            sum +
                            a.ReceiptBooks.reduce((s, b) => s + (b.ReceiptStub?.status === 'collected' ? 1 : 0), 0),
                        0
                    ),
                },
                details: agents.map((a) => ({
                    id: a.agentID,
                    name: `${a.name} ${a.lastname}`,
                    visitsCompleted: a.Visits.filter((v) => v.status === 'validated').length,
                    stubsCollected: a.ReceiptBooks.reduce(
                        (sum, b) => sum + (b.ReceiptStub?.status === 'collected' ? 1 : 0),
                        0
                    ),
                    region: a.Delegation?.Governorate?.Region?.name || 'N/A',
                    performanceScore: (
                        (a.Visits.filter((v) => v.status === 'validated').length / (a.Visits.length || 1)) *
                        100
                    ).toFixed(1),
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
                include: [
                    {
                        model: Governorate,
                        include: [
                            {
                                model: Delegation,
                                include: [
                                    {
                                        model: Agent,
                                        include: [
                                            { model: Visit, where: visitWhere, required: false },
                                            {
                                                model: ReceiptBook,
                                                include: [{ model: ReceiptStub, required: false }],
                                                required: false,
                                            },
                                        ],
                                        required: false,
                                    },
                                ],
                                required: false,
                            },
                        ],
                        required: false,
                    },
                ],
            });

            return {
                summary: {
                    totalRegions: regions.length,
                    totalVisits: regions.reduce(
                        (sum, r) =>
                            sum +
                            r.Governorates.reduce(
                                (s, g) =>
                                    s +
                                    g.Delegations.reduce((t, d) => t + (d.Agent?.Visits.length || 0), 0),
                                0
                            ),
                        0
                    ),
                    totalStubs: regions.reduce(
                        (sum, r) =>
                            sum +
                            r.Governorates.reduce(
                                (s, g) =>
                                    s +
                                    g.Delegations.reduce(
                                        (t, d) =>
                                            t +
                                            (d.Agent?.ReceiptBooks.reduce(
                                                (u, b) => u + (b.ReceiptStub ? 1 : 0),
                                                0
                                            ) || 0),
                                        0
                                    ),
                                0
                            ),
                        0
                    ),
                },
                details: regions.map((r) => ({
                    id: r.regionID,
                    name: r.name || 'N/A',
                    visitsCompleted: r.Governorates.reduce(
                        (sum, g) =>
                            sum +
                            g.Delegations.reduce(
                                (s, d) => s + (d.Agent?.Visits.filter((v) => v.status === 'validated').length || 0),
                                0
                            ),
                        0
                    ),
                    stubsCollected: r.Governorates.reduce(
                        (sum, g) =>
                            sum +
                            g.Delegations.reduce(
                                (s, d) =>
                                    s +
                                    (d.Agent?.ReceiptBooks.reduce(
                                        (t, b) => t + (b.ReceiptStub?.status === 'collected' ? 1 : 0),
                                        0
                                    ) || 0),
                                0
                            ),
                        0
                    ),
                    performanceScore: (
                        (r.Governorates.reduce(
                            (sum, g) =>
                                sum +
                                g.Delegations.reduce(
                                    (s, d) =>
                                        s + (d.Agent?.Visits.filter((v) => v.status === 'validated').length || 0),
                                    0
                                ),
                            0
                        ) /
                            (r.Governorates.reduce(
                                (sum, g) =>
                                    sum +
                                    g.Delegations.reduce((s, d) => s + (d.Agent?.Visits.length || 0), 0),
                                0
                            ) || 1)) *
                        100
                    ).toFixed(1),
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
            const [
                visitSummary,
                timesheet,
                receiptBookInventory,
                stubCollection,
                userActivity,
                aiAnomaly,
                agentPerformance,
                regionPerformance,
            ] = await Promise.all([
                this.generateVisitSummaryReport({ supervisorID, dateRange, regionID }),
                this.generateTimesheetReport({ supervisorID, regionalManagerID, dateRange }),
                this.generateReceiptBookInventoryReport({ dateRange, regionID }),
                this.generateStubCollectionReport({ supervisorID, regionalManagerID, dateRange }),
                this.generateUserActivityReport({ dateRange }),
                this.generateAIAnomalyReport({ dateRange }),
                this.generateAgentPerformanceReport({ supervisorID, regionalManagerID, dateRange, regionID }),
                this.generateRegionPerformanceReport({ regionalManagerID, dateRange, regionID }),
            ]);

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

                doc.fontSize(14).text('Summary', { underline: true });
                doc.fontSize(12);
                for (const [key, value] of Object.entries(sectionData.summary)) {
                    doc.text(`${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}`);
                }
                doc.moveDown();

                if (sectionData.details && sectionData.details.length) {
                    doc.fontSize(14).text('Details', { underline: true });
                    const headers = Object.keys(sectionData.details[0]).map(h => h.replace(/([A-Z])/g, ' $1').trim());
                    const colWidths = headers.map(() => 500 / headers.length); // Equal widths for simplicity
                    const tableTop = doc.y + 10;
                    let y = this.drawTable(doc, headers, sectionData.details, tableTop, colWidths);
                    // Add signature
                    if (y + 50 > doc.page.height - 50) {
                        doc.addPage();
                        y = 50;
                    }
                    doc.fontSize(10).text(`Report generated on ${new Date().toLocaleString()}`, 50, y + 20);
                    doc.text('Authorized by TraceFlow', 50, y + 40);
                }
            }
        } else {
            doc.fontSize(14).text('Summary', { underline: true });
            doc.fontSize(12);
            for (const [key, value] of Object.entries(data.summary)) {
                doc.text(`${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}`);
            }
            doc.moveDown();

            if (data.details && data.details.length) {
                doc.fontSize(14).text('Details', { underline: true });
                const headers = Object.keys(data.details[0]).map(h => h.replace(/([A-Z])/g, ' $1').trim());
                const colWidths = headers.map(() => 500 / headers.length);
                const tableTop = doc.y + 10;
                let y = this.drawTable(doc, headers, data.details, tableTop, colWidths);
                // Add signature
                if (y + 50 > doc.page.height - 50) {
                    doc.addPage();
                    y = 50;
                }
                doc.fontSize(10).text(`Report generated on ${new Date().toLocaleString()}`, 50, y + 20);
                doc.text('Authorized by TraceFlow', 50, y + 40);
            }
        }

        doc.end();
    }

    static drawTable(doc, headers, data, startY, colWidths) {
        let y = startY;

        // Draw headers
        doc.fontSize(10).font('Helvetica-Bold');
        headers.forEach((header, i) => {
            doc.text(header, 50 + i * colWidths[i], y, { width: colWidths[i] - 10, align: 'left' });
        });
        y += 20; // Header height

        // Draw rows
        doc.font('Helvetica');
        data.forEach((row) => {
            const cellHeights = headers.map((header, i) => {
                const text = String(row[header] || 'N/A');
                return doc.heightOfString(text, { width: colWidths[i] - 10 });
            });
            const rowHeight = Math.max(...cellHeights) + 10; // Add padding

            // Check if we need a new page
            if (y + rowHeight > doc.page.height - 50) {
                doc.addPage();
                y = 50;
                // Redraw headers
                doc.fontSize(10).font('Helvetica-Bold');
                headers.forEach((header, i) => {
                    doc.text(header, 50 + i * colWidths[i], y, { width: colWidths[i] - 10, align: 'left' });
                });
                y += 20;
                doc.font('Helvetica');
            }

            // Draw each cell
            headers.forEach((header, i) => {
                const text = String(row[header] || 'N/A');
                doc.text(text, 50 + i * colWidths[i], y, { width: colWidths[i] - 10, align: 'left' });
            });
            y += rowHeight;
        });

        return y;
    }

    static async generateExcel(data, reportType, filePath) {
        const workbook = xlsx.utils.book_new();

        if (reportType === 'Full') {
            for (const [section, sectionData] of Object.entries(data)) {
                // Summary sheet
                const summaryTitle = `${section.replace(/([A-Z])/g, ' $1').trim()} Summary`;
                const summarySheetData = this.buildSummarySheetData(summaryTitle, sectionData.summary);
                const summaryWs = xlsx.utils.aoa_to_sheet(summarySheetData);
                summaryWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
                xlsx.utils.book_append_sheet(workbook, summaryWs, `${section}_Summary`.slice(0, 31));

                if (sectionData.details && sectionData.details.length) {
                    // Details sheet
                    const detailsTitle = `${section.replace(/([A-Z])/g, ' $1').trim()} Details`;
                    const headers = Object.keys(sectionData.details[0]);
                    const detailsSheetData = this.buildSheetData(detailsTitle, headers, sectionData.details);
                    const detailsWs = xlsx.utils.aoa_to_sheet(detailsSheetData);
                    detailsWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
                    xlsx.utils.book_append_sheet(workbook, detailsWs, `${section}_Details`.slice(0, 31));
                }
            }
        } else {
            // Summary sheet
            const summaryTitle = 'Summary';
            const summarySheetData = this.buildSummarySheetData(summaryTitle, data.summary);
            const summaryWs = xlsx.utils.aoa_to_sheet(summarySheetData);
            summaryWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
            xlsx.utils.book_append_sheet(workbook, summaryWs, 'Summary');

            if (data.details && data.details.length) {
                // Details sheet
                const detailsTitle = 'Details';
                const headers = Object.keys(data.details[0]);
                const detailsSheetData = this.buildSheetData(detailsTitle, headers, data.details);
                const detailsWs = xlsx.utils.aoa_to_sheet(detailsSheetData);
                detailsWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
                xlsx.utils.book_append_sheet(workbook, detailsWs, 'Details');
            }
        }

        xlsx.writeFile(workbook, filePath);
    }

    static buildSheetData(title, headers, data) {
        const titleRow = [title];
        const headerRow = headers.map(h => h.replace(/([A-Z])/g, ' $1').trim());
        const dataRows = data.map(row => headers.map(h => row[h] || 'N/A'));
        const footerRow = ['Generated on ' + new Date().toLocaleString()];
        return [titleRow, headerRow, ...dataRows, footerRow];
    }

    static buildSummarySheetData(title, summary) {
        const titleRow = [title];
        const summaryRows = Object.entries(summary).map(([key, value]) => [
            key.replace(/([A-Z])/g, ' $1').trim(),
            value,
        ]);
        const footerRow = ['Generated on ' + new Date().toLocaleString()];
        return [titleRow, ...summaryRows, footerRow];
    }
}

module.exports = ReportService;