import api from './axiosConfig';
import { ReportFilters } from '../models/Report';

// Interface for the response of generateReport
interface GenerateReportResponse {
    reportPath: string;
}

// Interface for the response of scheduleReport
interface ScheduleReportResponse {
    message: string;
    scheduleID: string;
}

/**
 * Generates a report based on the specified type, filters, and format.
 * @param reportType - Type of report (e.g., VisitSummary, Timesheet).
 * @param filters - Filters to apply to the report.
 * @param format - Output format (pdf or excel).
 * @returns Promise resolving to the report download path.
 */
export const generateReport = async (
    reportType: string,
    filters: ReportFilters,
    format: 'pdf' | 'excel'
): Promise<GenerateReportResponse> => {
    try {
        const response = await api.post<GenerateReportResponse>('/reports/generate', {
            reportType,
            filters,
            format,
        });
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.error || 'Failed to generate report');
    }
};

/**
 * Schedules a report for periodic generation.
 * @param reportType - Type of report (e.g., VisitSummary, Timesheet).
 * @param filters - Filters to apply to the report.
 * @param format - Output format (pdf or excel).
 * @param cronExpression - Cron expression for scheduling.
 * @returns Promise resolving to the schedule ID and success message.
 */
export const scheduleReport = async (
    reportType: string,
    filters: ReportFilters,
    format: 'pdf' | 'excel',
    cronExpression: string
): Promise<ScheduleReportResponse> => {
    try {
        const response = await api.post<ScheduleReportResponse>('/reports/schedule', {
            reportType,
            filters,
            format,
            cronExpression,
        });
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.error || 'Failed to schedule report');
    }
};

/**
 * Downloads a generated report file.
 * @param file - The file name of the report to download.
 * @returns Promise resolving to the file URL for download.
 */
export const downloadReport = async (file: string): Promise<string> => {
    try {
        const response = await api.get(`/reports/download?file=${encodeURIComponent(file)}`, {
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        return url;
    } catch (error: any) {
        throw new Error(error.response?.data?.error || 'Failed to download report');
    }
};