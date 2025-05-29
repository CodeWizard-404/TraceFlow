interface VisitSummaryReport {
    summary: {
        totalVisits: number;
        validatedVisits: number;
        pendingVisits: number;
        averageDuration: string;
    };
    details: Array<{
        id: string;
        date: string;
        location: string;
        status: string;
        agent: string;
        supervisor: string;
        region: string;
    }>;
}

interface TimesheetReport {
    summary: {
        totalTimesheets: number;
        totalHours: number;
        validatedTimesheets: number;
    };
    details: Array<{
        id: string;
        supervisor: string;
        week: string;
        status: string;
        totalHours: string;
        visitReasons: string[];
    }>;
}

interface ReceiptBookInventoryReport {
    summary: {
        totalBooks: number;
        inStock: number;
        withAgents: number;
        archived: number;
    };
    details: Array<{
        id: string;
        number: string;
        status: string;
        type: string;
        region: string;
        currentHolder: string;
    }>;
}

interface StubCollectionReport {
    summary: {
        total: number;
        collected: number;
        transmitted: number;
        archived: number;
    };
    details: Array<{
        id: string;
        bookNumber: string;
        status: string;
        agent: string;
        currentHolder: string;
    }>;
}

interface UserActivityReport {
    summary: {
        totalActivities: number;
        uniqueUsers: number;
        lastActivity: string;
    };
    details: Array<{
        user: string;
        role: string;
        activity: string;
        timestamp: string;
        status: string;
        suspicious: string;
    }>;
}

interface AIAnomalyReport {
    summary: {
        totalAnomalies: number;
    };
    details: Array<{
        id: string;
        user: string;
        role: string;
        anomaly: string;
        affected: string;
        timestamp: string;
    }>;
}

interface AgentPerformanceReport {
    summary: {
        totalAgents: number;
        totalVisits: number;
        totalStubsCollected: number;
    };
    details: Array<{
        id: string;
        name: string;
        visitsCompleted: number;
        stubsCollected: number;
        region: string;
        performanceScore: string;
    }>;
}

interface RegionPerformanceReport {
    summary: {
        totalRegions: number;
        totalVisits: number;
        totalStubs: number;
    };
    details: Array<{
        id: string;
        name: string;
        visitsCompleted: number;
        stubsCollected: number;
        performanceScore: string;
    }>;
}

interface FullReport {
    visitSummary: VisitSummaryReport;
    timesheet: TimesheetReport;
    receiptBookInventory: ReceiptBookInventoryReport;
    stubCollection: StubCollectionReport;
    userActivity: UserActivityReport;
    aiAnomaly: AIAnomalyReport;
    agentPerformance: AgentPerformanceReport;
    regionPerformance: RegionPerformanceReport;
}

interface ReportSchedule {
    scheduleID: string;
    reportType: string;
    filters: Record<string, any>;
    format: 'pdf' | 'excel';
    cronExpression: string;
    createdBy: string;
}

interface GenerateReportResponse {
    reportPath: string;
}

interface ScheduleReportResponse {
    message: string;
    scheduleID: string;
}

interface DownloadReportResponse {
    [key: string]: any;
}

export type {
    VisitSummaryReport,
    TimesheetReport,
    ReceiptBookInventoryReport,
    StubCollectionReport,
    UserActivityReport,
    AIAnomalyReport,
    AgentPerformanceReport,
    RegionPerformanceReport,
    FullReport,
    ReportSchedule,
    GenerateReportResponse,
    ScheduleReportResponse,
    DownloadReportResponse,
};