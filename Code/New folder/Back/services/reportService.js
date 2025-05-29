const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
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
                    { model: Timesheet, include: [{ model: User }], required: false },
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
                        model: User,
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
                    total: stubs.length,
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
            const logs = await Log.findAll({ where });
            const userIds = [...new Set(logs.map((l) => l.userId).filter((id) => id))];
            const users = await User.findAll({
                where: { userID: { [Op.in]: userIds } },
                include: [
                    {
                        model: Role,
                        where: roleWhere,
                        required: !!roleID,
                        through: { attributes: [] },
                    },
                ],
            });

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
            const logs = await Log.findAll({ where });
            const userIds = [...new Set(logs.map((l) => l.userId).filter((id) => id))];
            const users = await User.findAll({
                where: { userID: { [Op.in]: userIds } },
                include: [
                    {
                        model: Role,
                        where: roleWhere,
                        required: !!roleID,
                        through: { attributes: [] },
                    },
                ],
            });

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
            throw error;
        }
    }

    static async generatePDF(data, reportType, filePath) {
        const doc = new PDFDocument({
            size: 'A4',
            margin: 40,
            bufferPages: true
        });
        doc.pipe(fs.createWriteStream(filePath));

        // Register modern font (Roboto)
        doc.registerFont('Roboto', path.join(__dirname, '../Templates/fonts/Roboto-Regular.ttf'));
        doc.registerFont('Roboto-Bold', path.join(__dirname, '../Templates/fonts/Roboto-Bold.ttf'));

        // Header with logo and title
        const logoPath = path.join(__dirname, '../Templates/logo/Logo.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 40, 30, { width: 80 });
        }

        doc.font('Roboto-Bold')
            .fontSize(24)
            .fillColor('#1A3C5A')
            .text(`TraceFlow ${reportType} Report`, 0, 40, { align: 'center' });
        doc.font('Roboto')
            .fontSize(10)
            .fillColor('#666')
            .text(`Generated on ${new Date().toLocaleString()}`, 0, 70, { align: 'center' });

        // Add a subtle header line
        doc.moveTo(40, 90).lineTo(555, 90).strokeColor('#E5E7EB').lineWidth(1).stroke();
        doc.moveDown(2);

        if (reportType === 'Full') {
            for (const [section, sectionData] of Object.entries(data)) {
                doc.addPage();
                // Section title
                doc.font('Roboto-Bold')
                    .fontSize(18)
                    .fillColor('#1A3C5A')
                    .text(section.replace(/([A-Z])/g, ' $1').trim(), 40, 40, { underline: true });
                doc.moveDown();

                // Summary section
                doc.font('Roboto-Bold')
                    .fontSize(14)
                    .fillColor('#2D6B9B')
                    .text('Summary', 40, doc.y, { underline: true });
                doc.moveDown(0.5);
                doc.font('Roboto')
                    .fontSize(11)
                    .fillColor('#333');
                for (const [key, value] of Object.entries(sectionData.summary)) {
                    doc.text(`${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}`, 50, doc.y, { continued: false });
                    doc.moveDown(0.3);
                }
                doc.moveDown();

                if (sectionData.details && sectionData.details.length) {
                    // Details section
                    doc.font('Roboto-Bold')
                        .fontSize(14)
                        .fillColor('#2D6B9B')
                        .text('Details', 40, doc.y, { underline: true });
                    const headers = Object.keys(sectionData.details[0]).map(h => h.replace(/([A-Z])/g, ' $1').trim());
                    const colWidths = headers.map(() => 515 / headers.length);
                    const tableTop = doc.y + 15;
                    let y = this.drawTable(doc, headers, sectionData.details, tableTop, colWidths);

                    // Signature block
                    if (y + 80 > doc.page.height - 40) {
                        doc.addPage();
                        y = 40;
                    }
                    doc.font('Roboto')
                        .fontSize(10)
                        .fillColor('#666')
                        .text('Digitally Authorized by TraceFlow', 40, y + 20);
                    doc.fontSize(8)
                        .text(`Generated: ${new Date().toLocaleString()}`, 40, y + 35);
                    doc.moveTo(40, y + 50)
                        .lineTo(200, y + 50)
                        .strokeColor('#2D6B9B')
                        .lineWidth(1)
                        .stroke();
                }
            }
        } else {
            // Summary section
            doc.font('Roboto-Bold')
                .fontSize(14)
                .fillColor('#2D6B9B')
                .text('Summary', 40, doc.y, { underline: true });
            doc.moveDown(0.5);
            doc.font('Roboto')
                .fontSize(11)
                .fillColor('#333');
            for (const [key, value] of Object.entries(data.summary)) {
                doc.text(`${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}`, 50, doc.y, { continued: false });
                doc.moveDown(0.3);
            }
            doc.moveDown();

            if (data.details && data.details.length) {
                // Details section
                doc.font('Roboto-Bold')
                    .fontSize(14)
                    .fillColor('#2D6B9B')
                    .text('Details', 40, doc.y, { underline: true });
                const headers = Object.keys(data.details[0]).map(h => h.replace(/([A-Z])/g, ' $1').trim());
                const colWidths = headers.map(() => 515 / headers.length);
                const tableTop = doc.y + 15;
                let y = this.drawTable(doc, headers, data.details, tableTop, colWidths);

                // Signature block
                if (y + 80 > doc.page.height - 40) {
                    doc.addPage();
                    y = 40;
                }
                doc.font('Roboto')
                    .fontSize(10)
                    .fillColor('#666')
                    .text('Digitally Authorized by TraceFlow', 40, y + 20);
                doc.fontSize(8)
                    .text(`Generated: ${new Date().toLocaleString()}`, 40, y + 35);
                doc.moveTo(40, y + 50)
                    .lineTo(200, y + 50)
                    .strokeColor('#2D6B9B')
                    .lineWidth(1)
                    .stroke();
            }
        }

        // Add page numbers
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            doc.font('Roboto')
                .fontSize(8)
                .fillColor('#666')
                .text(`Page ${i + 1} of ${pageCount}`, 0, doc.page.height - 30, { align: 'center' });
        }

        doc.end();
    }

    static drawTable(doc, headers, data, startY, colWidths) {
        let y = startY;

        // Draw table header background
        doc.rect(40, y - 5, 515, 25)
            .fillColor('#F3F4F6')
            .fill();

        // Draw headers
        doc.font('Roboto-Bold')
            .fontSize(10)
            .fillColor('#1A3C5A');
        headers.forEach((header, i) => {
            doc.text(header, 45 + i * colWidths[i], y, { width: colWidths[i] - 10, align: 'left' });
        });
        y += 25;

        // Draw table grid and rows
        doc.font('Roboto')
            .fontSize(9);
        data.forEach((row, rowIndex) => {
            const cellHeights = headers.map((header, i) => {
                const text = String(row[header.toLowerCase().replace(/\s/g, '')] || 'N/A');
                return doc.heightOfString(text, { width: colWidths[i] - 10 });
            });
            const rowHeight = Math.max(...cellHeights) + 12;

            // Check for page break
            if (y + rowHeight > doc.page.height - 40) {
                doc.addPage();
                y = 40;
                // Redraw header background
                doc.rect(40, y - 5, 515, 25)
                    .fillColor('#F3F4F6')
                    .fill();
                // Redraw headers
                doc.font('Roboto-Bold')
                    .fontSize(10)
                    .fillColor('#1A3C5A');
                headers.forEach((header, i) => {
                    doc.text(header, 45 + i * colWidths[i], y, { width: colWidths[i] - 10, align: 'left' });
                });
                y += 25;
                doc.font('Roboto')
                    .fontSize(9);
            }

            // Draw row background (alternate colors)
            if (rowIndex % 2 === 0) {
                doc.rect(40, y - 5, 515, rowHeight)
                    .fillColor('#F9FAFB')
                    .fill();
            }

            // Draw cells with explicit text color
            doc.fillColor('#000000'); // Changed to black for maximum contrast
            headers.forEach((header, i) => {
                const text = String(row[header.toLowerCase().replace(/\s/g, '')] || 'N/A');
                doc.text(text, 45 + i * colWidths[i], y, { width: colWidths[i] - 10, align: 'left' });
            });

            // Draw row border
            doc.moveTo(40, y + rowHeight - 5)
                .lineTo(555, y + rowHeight - 5)
                .strokeColor('#E5E7EB')
                .lineWidth(0.5)
                .stroke();

            y += rowHeight;
        });

        // Draw vertical lines
        let x = 40;
        colWidths.forEach((width) => {
            doc.moveTo(x, startY - 5)
                .lineTo(x, y - 5)
                .strokeColor('#E5E7EB')
                .lineWidth(0.5)
                .stroke();
            x += width;
        });
        doc.moveTo(555, startY - 5)
            .lineTo(555, y - 5)
            .stroke();

        return y;
    }

    static async generateExcel(data, reportType, filePath) {
        const workbook = new ExcelJS.Workbook();
        workbook.created = new Date();
        workbook.modified = new Date();

        // Define styles
        const headerStyle = {
            font: { name: 'Roboto', size: 12, bold: true, color: { argb: '1A3C5A' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3F4F6' } },
            alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
            border: {
                top: { style: 'thin', color: { argb: 'E5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
                left: { style: 'thin', color: { argb: 'E5E7EB' } },
                right: { style: 'thin', color: { argb: 'E5E7EB' } },
            },
        };
        const cellStyle = {
            font: { name: 'Roboto', size: 10, color: { argb: '333333' } },
            alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
            border: {
                top: { style: 'thin', color: { argb: 'E5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
                left: { style: 'thin', color: { argb: 'E5E7EB' } },
                right: { style: 'thin', color: { argb: 'E5E7EB' } },
            },
        };
        const titleStyle = {
            font: { name: 'Roboto', size: 14, bold: true, color: { argb: '2D6B9B' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
        };
        const footerStyle = {
            font: { name: 'Roboto', size: 8, color: { argb: '666666' } },
            alignment: { horizontal: 'left', vertical: 'middle' },
        };

        if (reportType === 'Full') {
            for (const [section, sectionData] of Object.entries(data)) {
                // Summary sheet
                const summaryTitle = `${section.replace(/([A-Z])/g, ' $1').trim()} Summary`;
                const summaryWs = workbook.addWorksheet(`${section}_Summary`.slice(0, 31));
                const summaryData = this.buildSummarySheetData(summaryTitle, sectionData.summary);

                // Write summary data
                summaryData.forEach((row, rowIndex) => {
                    const wsRow = summaryWs.getRow(rowIndex + 1);
                    row.forEach((cell, cellIndex) => {
                        wsRow.getCell(cellIndex + 1).value = cell;
                        if (rowIndex === 0) {
                            wsRow.getCell(cellIndex + 1).style = titleStyle;
                            wsRow.getCell(cellIndex + 1).merge(summaryWs.getRow(rowIndex + 1).getCell(cellIndex + 2));
                        } else if (rowIndex === summaryData.length - 1) {
                            wsRow.getCell(cellIndex + 1).style = footerStyle;
                        } else {
                            wsRow.getCell(cellIndex + 1).style = cellStyle;
                        }
                    });
                });

                // Set column widths
                summaryWs.columns = [{ width: 30 }, { width: 20 }];

                if (sectionData.details && sectionData.details.length) {
                    // Details sheet
                    const detailsTitle = `${section.replace(/([A-Z])/g, ' $1').trim()} Details`;
                    const detailsWs = workbook.addWorksheet(`${section}_Details`.slice(0, 31));
                    const headers = Object.keys(sectionData.details[0]);
                    const detailsData = this.buildSheetData(detailsTitle, headers, sectionData.details);

                    // Write details data
                    detailsData.forEach((row, rowIndex) => {
                        const wsRow = detailsWs.getRow(rowIndex + 1);
                        row.forEach((cell, cellIndex) => {
                            wsRow.getCell(cellIndex + 1).value = cell;
                            if (rowIndex === 0) {
                                wsRow.getCell(cellIndex + 1).style = titleStyle;
                                if (cellIndex === 0) {
                                    wsRow.getCell(cellIndex + 1).merge(detailsWs.getRow(rowIndex + 1).getCell(headers.length));
                                }
                            } else if (rowIndex === 1) {
                                wsRow.getCell(cellIndex + 1).style = headerStyle;
                            } else if (rowIndex === detailsData.length - 1) {
                                wsRow.getCell(cellIndex + 1).style = footerStyle;
                            } else {
                                wsRow.getCell(cellIndex + 1).style = cellStyle;
                                // Conditional formatting for status column
                                if (cellIndex === headers.indexOf('status') && cell === 'validated') {
                                    wsRow.getCell(cellIndex + 1).fill = {
                                        type: 'pattern',
                                        pattern: 'solid',
                                        fgColor: { argb: 'E6F3E6' },
                                    };
                                }
                            }
                        });
                    });

                    // Set column widths
                    detailsWs.columns = headers.map(() => ({ width: 20 }));
                }
            }
        } else {
            // Summary sheet
            const summaryTitle = 'Summary';
            const summaryWs = workbook.addWorksheet('Summary');
            const summaryData = this.buildSummarySheetData(summaryTitle, data.summary);

            // Write summary data
            summaryData.forEach((row, rowIndex) => {
                const wsRow = summaryWs.getRow(rowIndex + 1);
                row.forEach((cell, cellIndex) => {
                    wsRow.getCell(cellIndex + 1).value = cell;
                    if (rowIndex === 0) {
                        wsRow.getCell(cellIndex + 1).style = titleStyle;
                        wsRow.getCell(cellIndex + 1).merge(summaryWs.getRow(rowIndex + 1).getCell(cellIndex + 2));
                    } else if (rowIndex === summaryData.length - 1) {
                        wsRow.getCell(cellIndex + 1).style = footerStyle;
                    } else {
                        wsRow.getCell(cellIndex + 1).style = cellStyle;
                    }
                });
            });

            // Set column widths
            summaryWs.columns = [{ width: 30 }, { width: 20 }];

            if (data.details && data.details.length) {
                // Details sheet
                const detailsTitle = 'Details';
                const detailsWs = workbook.addWorksheet('Details');
                const headers = Object.keys(data.details[0]);
                const detailsData = this.buildSheetData(detailsTitle, headers, data.details);

                // Write details data
                detailsData.forEach((row, rowIndex) => {
                    const wsRow = detailsWs.getRow(rowIndex + 1);
                    row.forEach((cell, cellIndex) => {
                        wsRow.getCell(cellIndex + 1).value = cell;
                        if (rowIndex === 0) {
                            wsRow.getCell(cellIndex + 1).style = titleStyle;
                            if (cellIndex === 0) {
                                wsRow.getCell(cellIndex + 1).merge(detailsWs.getRow(rowIndex + 1).getCell(headers.length));
                            }
                        } else if (rowIndex === 1) {
                            wsRow.getCell(cellIndex + 1).style = headerStyle;
                        } else if (rowIndex === detailsData.length - 1) {
                            wsRow.getCell(cellIndex + 1).style = footerStyle;
                        } else {
                            wsRow.getCell(cellIndex + 1).style = cellStyle;
                            // Conditional formatting for status column
                            if (cellIndex === headers.indexOf('status') && cell === 'validated') {
                                wsRow.getCell(cellIndex + 1).fill = {
                                    type: 'pattern',
                                    pattern: 'solid',
                                    fgColor: { argb: 'E6F3E6' },
                                };
                            }
                        }
                    });
                });

                // Set column widths
                detailsWs.columns = headers.map(() => ({ width: 20 }));
            }
        }

        await workbook.xlsx.writeFile(filePath);
    }

    static buildSheetData(title, headers, data) {
        const titleRow = [title];
        const headerRow = headers.map(h => h.replace(/([A-Z])/g, ' $1').trim());
        const dataRows = data.map(row => headers.map(h => row[h] || 'N/A'));
        const footerRow = [`Digitally Authorized by TraceFlow | Generated on ${new Date().toLocaleString()}`];
        return [titleRow, headerRow, ...dataRows, footerRow];
    }

    static buildSummarySheetData(title, summary) {
        const titleRow = [title];
        const summaryRows = Object.entries(summary).map(([key, value]) => [
            key.replace(/([A-Z])/g, ' $1').trim(),
            value,
        ]);
        const footerRow = [`Digitally Authorized by TraceFlow | Generated on ${new Date().toLocaleString()}`];
        return [titleRow, ...summaryRows, footerRow];
    }
}

module.exports = ReportService;