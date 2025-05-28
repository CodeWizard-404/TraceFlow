export type ReportType =
    | 'VisitSummary'
    | 'Timesheet'
    | 'ReceiptBookInventory'
    | 'StubCollection'
    | 'UserActivity'
    | 'AIAnomaly'
    | 'AgentPerformance'
    | 'RegionPerformance'
    | 'Full';

// Interface for date range filter
export interface DateRange {
    start: string;
    end: string;
}

// Interface for report filters, dynamically typed based on report type
export interface ReportFilters {
    supervisorID?: string;
    regionalManagerID?: string;
    dateRange?: DateRange;
    regionID?: string;
    agentID?: string;
    status?: string;
    bookType?: string;
    roleID?: string;
    activityType?: string;
    anomalyType?: string;
    filterBy?: 'supervisor' | 'regionalManager';
}

// Interface for a scheduled report
export interface ReportSchedule {
    scheduleID: string;
    reportType: ReportType;
    filters: ReportFilters;
    format: 'pdf' | 'excel';
    cronExpression: string;
    createdBy: string;
}