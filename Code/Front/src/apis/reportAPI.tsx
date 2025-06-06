// api/reports.ts
import { AxiosError } from "axios";
import api from "./axiosConfig";
import {
    GenerateReportResponse,
    ScheduleReportResponse,
    DownloadReportResponse,

} from ".";
import {
    ReportSchedule,
    GeneratedReport,
} from "../models/Report";
import { de } from "date-fns/locale";


// Generic error handler
const handleApiError = (error: unknown, defaultMessage: string): string => {
    const axiosError = error as AxiosError<{ error: string }>;
    if (axiosError.response?.data?.error) {
        return axiosError.response.data.error;
    }
    switch (axiosError.response?.status) {
        case 400:
            return "Invalid request. Please check your input and try again.";
        case 401:
            return "Authentication failed. Please log in again.";
        case 403:
            return "You don’t have permission to perform this action.";
        case 404:
            return "Resource not found.";
        case 500:
            return "Something went wrong on our end. Please try again later.";
        default:
            return defaultMessage;
    }
};

// Valid report types
const validReportTypes = [
    "VisitSummary",
    "Timesheet",
    "ReceiptBookInventory",
    "StubCollection",
    "UserActivity",
    "Anomaly",
    "AgentPerformance",
    "RegionPerformance",
    "Full",
];

// Valid formats
const validFormats = ["pdf", "excel"];

// Allowed filters for each report type
const allowedFilters: Record<string, string[]> = {
    VisitSummary: [
        "supervisorID",
        "dateRange",
        "regionID",
        "agentID",
        "status",
        "visitReasons",
        "checklistCompleted",
        "visitDuration",
        "governorateID",
        "delegationID",
        "visitType",
        "Anomalies",
    ],
    Timesheet: [
        "supervisorID",
        "regionalManagerID",
        "directorID",
        "dateRange",
        "status",
        "numberOfVisits",
        "totalHours",
        "aiSuggestions",
        "anomaliesDetected",
        "visitStatus",
        "weekNumber",
        "checklistCompleted",
    ],
    ReceiptBookInventory: [
        "dateRange",
        "regionID",
        "bookType",
        "status",
        "governorateID",
        "delegationID",
        "currentHolderName",
        "assignmentStatus",
    ],
    StubCollection: [
        "agentID",
        "supervisorID",
        "regionalManagerID",
        "dateRange",
        "status",
        "currentHolderName",
    ],
    UserActivity: [
        "roleID",
        "dateRange",
        "activityType",
        "userID",
        "status",
        "suspiciousActivity",
        "ipAddress",
    ],
    Anomaly: [
        "dateRange",
        "roleID",
        "userID",
        "affectedEntity",
        "severity",
        "route",
    ],
    AgentPerformance: [
        "supervisorID",
        "regionalManagerID",
        "dateRange",
        "agentID",
        "numberOfVisits",
        "stubsCollected",
        "receiptBooksAssigned",
        "regionID",
        "governorateID",
        "delegationID",
        "locationUpdated",
    ],
    RegionPerformance: [
        "regionalManagerID",
        "dateRange",
        "regionID",
        "governorateID",
        "delegationID",
        "performanceScore",
        "numberOfVisits",
        "stubsCollected",
    ],
    Full: [
        "supervisorID",
        "regionalManagerID",
        "dateRange",
        "regionID",
        "agentID",
        "status",
        "visitReasons",
    ],
};

// Validate filters
const validateFilters = (reportType: string, filters: Record<string, any>): Record<string, any> => {
    const validFilters = allowedFilters[reportType] || [];
    const validated: Record<string, any> = {};
    for (const [key, value] of Object.entries(filters)) {
        if (validFilters.includes(key) && value !== undefined && value !== null) {
            validated[key] = value;
        }
    }
    if (reportType === "Full" && !validated.supervisorID && !validated.regionalManagerID) {
        throw new Error("Either supervisorID or regionalManagerID is required for Full report");
    }
    if (validated.dateRange && (!validated.dateRange.start || !validated.dateRange.end)) {
        throw new Error("Invalid date range: both start and end dates are required");
    }
    return validated;
};

// Generate a report
export const generateReport = async (data: {
    reportType: string;
    filters?: Record<string, any>;
    format: "pdf" | "excel";
}): Promise<GenerateReportResponse> => {
    try {
        if (!data.reportType || !data.format) {
            throw new Error("Report type and format are required.");
        }
        if (!validFormats.includes(data.format)) {
            throw new Error("Invalid format. Use 'pdf' or 'excel'.");
        }
        if (!validReportTypes.includes(data.reportType)) {
            throw new Error("Invalid report type.");
        }
        const validatedFilters = validateFilters(data.reportType, data.filters || {});
        const response = await api.post<GenerateReportResponse>("/reports/generate", {
            reportType: data.reportType,
            filters: validatedFilters,
            format: data.format,
        });
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to generate report."));
    }
};

// Schedule a recurring report
export const scheduleReport = async (data: {
    reportType: string;
    filters?: Record<string, any>;
    format: "pdf" | "excel";
    cronExpression: string;
}): Promise<ScheduleReportResponse> => {
    try {
        if (!data.reportType || !data.format || !data.cronExpression) {
            throw new Error("Report type, format, and cron expression are required.");
        }
        if (!validFormats.includes(data.format)) {
            throw new Error("Invalid format. Use 'pdf' or 'excel'.");
        }
        if (!validReportTypes.includes(data.reportType)) {
            throw new Error("Invalid report type.");
        }
        // Basic cron expression validation (more complex validation is handled by backend)
        if (!/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/.test(data.cronExpression)) {
            throw new Error("Invalid cron expression format.");
        }
        const validatedFilters = validateFilters(data.reportType, data.filters || {});
        const response = await api.post<ScheduleReportResponse>("/reports/schedule", {
            reportType: data.reportType,
            filters: validatedFilters,
            format: data.format,
            cronExpression: data.cronExpression,
        });
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to schedule report."));
    }
};

// Download a generated report
export const downloadReport = async (file: string): Promise<DownloadReportResponse> => {
    try {
        if (!file) {
            throw new Error("File name is required.");
        }
        const response = await api.get<DownloadReportResponse>("/reports/download", {
            params: { file },
            responseType: "blob",
        });
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to download report."));
    }
};

// List all scheduled reports
export const listSchedules = async (): Promise<ReportSchedule[]> => {
    try {
        const response = await api.get<ReportSchedule[]>("/reports/schedules");
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to list report schedules."));
    }
};

// List all generated reports
export const listGeneratedReports = async (): Promise<GeneratedReport[]> => {
    try {
        const response = await api.get<GeneratedReport[]>("/reports/generated");
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to list generated reports."));
    }
};

// Delete a scheduled report
export const deleteSchedule = async (scheduleID: string): Promise<{ message: string }> => {
    try {
        if (!scheduleID) {
            throw new Error("Schedule ID is required.");
        }
        const response = await api.delete<{ message: string }>(`/reports/schedules/${scheduleID}`);
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to delete report schedule."));
    }
};

// Delete a generated report
export const deleteGeneratedReport = async (reportID: string): Promise<{ message: string }> => {
    try {
        if (!reportID) {
            throw new Error("Report ID is required.");
        }
        const response = await api.delete<{ message: string }>(`/reports/generated/${reportID}`);
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to delete generated report."));
    }
};

export default {
    generateReport,
    scheduleReport,
    downloadReport,
    listSchedules,
    listGeneratedReports,
    deleteSchedule,
    deleteGeneratedReport,
};