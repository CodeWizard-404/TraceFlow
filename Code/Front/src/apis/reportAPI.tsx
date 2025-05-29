// api/reports.ts
import { AxiosError } from "axios";
import api from "./axiosConfig";
import { AxiosErrorResponse } from ".";

// Report API response types
export type GenerateReportResponse = { reportPath: string };
export type ScheduleReportResponse = { message: string; scheduleID: string };
export type DownloadReportResponse = ArrayBuffer;
export type ReportSchedule = {
    scheduleID: string;
    reportType: string;
    format: 'pdf' | 'excel';
    cronExpression: string;
    createdBy: string;
    createdAt: string;
    creator?: {
        userID: string;
        firstname: string;
        lastname: string;
    };
};
export type GeneratedReport = {
    generatedReportID: string;
    reportType: string;
    format: 'pdf' | 'excel';
    filePath: string;
    generatedAt: string;
    generatedBy: string | null;
    scheduleID: string | null;
    generator?: {
        userID: string;
        firstname: string;
        lastname: string;
    };
    schedule?: {
        scheduleID: string;
        reportType: string;
        format: 'pdf' | 'excel';
        cronExpression: string;
    };
};

// Generic error handler
const handleApiError = (error: unknown, defaultMessage: string): string => {
    const axiosError = error as AxiosError<AxiosErrorResponse>;
    if (axiosError.response) {
        return axiosError.message;
    }
    switch (axiosError.status) {
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

// Generate a report
export const generateReport = async (data: {
    reportType: string;
    filters?: Record<string, any>;
    format: 'pdf' | 'excel';
}): Promise<GenerateReportResponse> => {
    try {
        if (!data.reportType || !data.format) {
            throw new Error("Report type and format are required.");
        }
        if (!['pdf', 'excel'].includes(data.format)) {
            throw new Error("Invalid format. Use 'pdf' or 'excel'.");
        }
        const validReportTypes = [
            'VisitSummary',
            'Timesheet',
            'ReceiptBookInventory',
            'StubCollection',
            'UserActivity',
            'AIAnomaly',
            'AgentPerformance',
            'RegionPerformance',
            'Full',
        ];
        if (!validReportTypes.includes(data.reportType)) {
            throw new Error("Invalid report type.");
        }
        const response = await api.post<GenerateReportResponse>("/reports/generate", data);
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to generate report."));
    }
};

// Schedule a recurring report
export const scheduleReport = async (data: {
    reportType: string;
    filters?: Record<string, any>;
    format: 'pdf' | 'excel';
    cronExpression: string;
}): Promise<ScheduleReportResponse> => {
    try {
        if (!data.reportType || !data.format || !data.cronExpression) {
            throw new Error("Report type, format, and cron expression are required.");
        }
        if (!['pdf', 'excel'].includes(data.format)) {
            throw new Error("Invalid format. Use 'pdf' or 'excel'.");
        }
        const validReportTypes = [
            'VisitSummary',
            'Timesheet',
            'ReceiptBookInventory',
            'StubCollection',
            'UserActivity',
            'AIAnomaly',
            'AgentPerformance',
            'RegionPerformance',
            'Full',
        ];
        if (!validReportTypes.includes(data.reportType)) {
            throw new Error("Invalid report type.");
        }
        const response = await api.post<ScheduleReportResponse>("/reports/schedule", data);
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
            responseType: 'blob', // For file download
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