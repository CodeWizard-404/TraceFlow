// types/reports.ts
export interface VisitSummaryReport {
    summary: {
        totalVisits: number;
        validatedVisits: number;
        pendingVisits: number;
        visitedVisits: number;
        rejectedVisits: number;
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
        reasons: string;
        checklistCompleted: boolean;
    }>;
}

export interface TimesheetReport {
    summary: {
        totalTimesheets: number;
        totalHours: number;
        validatedTimesheets: number;
        pendingTimesheets: number;
        rejectedTimesheets: number;
    };
    details: Array<{
        id: string;
        supervisor: string;
        week: string;
        status: string;
        totalHours: string;
        visitReasons: string;
        numberOfVisits: number;
        checklistCompleted: boolean;
    }>;
}

export interface ReceiptBookInventoryReport {
    summary: {
        totalBooks: number;
        inStock: number;
        withAgents: number;
        withSupervisors: number;
        archived: number;
    };
    details: Array<{
        id: string;
        number: string;
        status: string;
        type: string;
        region: string;
        currentHolder: string;
        assignedToAgent: boolean;
    }>;
}

export interface StubCollectionReport {
    summary: {
        totalStubs: number;
        collected: number;
        transmitted: number;
        archived: number;
        pending: number;
    };
    details: Array<{
        id: string;
        stubNumber: string;
        bookNumber: string;
        status: string;
        agent: string;
        currentHolder: string;
        region: string;
    }>;
}

export interface UserActivityReport {
    summary: {
        totalActivities: number;
        uniqueUsers: number;
        suspiciousActivities: number;
        lastActivity: string;
    };
    details: Array<{
        id: string;
        user: string;
        role: string;
        activity: string;
        timestamp: string;
        status: string;
        suspicious: string;
        ipAddress: string;
        deviceType: string;
    }>;
}

export interface AnomalyReport {
    summary: {
        totalAnomalies: number;
        warningAnomalies: number;
        errorAnomalies: number;
        uniqueUsers: number;
    };
    details: Array<{
        id: string;
        user: string;
        role: string;
        anomaly: string;
        affected: string;
        severity: string;
        timestamp: string;
        route: string;
    }>;
}

export interface AgentPerformanceReport {
    summary: {
        totalAgents: number;
        totalVisits: number;
        totalStubsCollected: number;
        totalReceiptBooksAssigned: number;
        averagePerformanceScore: string;
    };
    details: Array<{
        id: string;
        name: string;
        visitsReceived: number;
        completedVisits: number;
        stubsCollected: number;
        receiptBooksAssigned: number;
        region: string;
        supervisor: string;
        performanceScore: string;
        locationUpdated: boolean;
    }>;
}

export interface RegionPerformanceReport {
    summary: {
        totalRegions: number;
        totalVisits: number;
        totalStubsCollected: number;
        averagePerformanceScore: string;
    };
    details: Array<{
        id: string;
        name: string;
        visits: number;
        visitsCompleted: number;
        stubsCollected: number;
        performanceScore: string;
        regionalManager: string;
    }>;
}

export interface FullReport {
    visitSummaryReport: VisitSummaryReport;
    timesheetReport: TimesheetReport;
    receiptBookInventoryReport: ReceiptBookInventoryReport;
    stubCollectionReport: StubCollectionReport;
    userActivityReport: UserActivityReport;
    AnomalyReport: AnomalyReport;
    agentPerformanceReport: AgentPerformanceReport;
    regionPerformanceReport: RegionPerformanceReport;
}






export interface ReportSchedule {
    scheduleID: string;
    reportType:
    | "VisitSummary"
    | "Timesheet"
    | "ReceiptBookInventory"
    | "StubCollection"
    | "UserActivity"
    | "Anomaly"
    | "AgentPerformance"
    | "RegionPerformance"
    | "Full";
    format: "pdf" | "excel";
    cronExpression: string;
    createdBy: string;
    createdAt: string;
    Creator?: {
        userID: string;
        firstname: string;
        lastname: string;
    };
    filters: Record<string, any>;
}

export interface GeneratedReport {
    generatedReportID: string;
    reportType:
    | "VisitSummary"
    | "Timesheet"
    | "ReceiptBookInventory"
    | "StubCollection"
    | "UserActivity"
    | "Anomaly"
    | "AgentPerformance"
    | "RegionPerformance"
    | "Full";
    format: "pdf" | "excel";
    filePath: string;
    generatedAt: string;
    generatedBy: string | null;
    scheduleID: string | null;
    Generator?: {
        userID: string;
        firstname: string;
        lastname: string;
    };
    Schedule?: {
        scheduleID: string;
        reportType: string;
        format: "pdf" | "excel";
        cronExpression: string;
    };
}