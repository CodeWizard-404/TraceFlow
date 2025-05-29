import { AxiosError } from "axios";
import api from "./axiosConfig";
import { AxiosErrorResponse, GenerateReportResponse, ScheduleReportResponse, DownloadReportResponse } from ".";

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