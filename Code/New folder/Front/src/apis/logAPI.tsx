import { AxiosError } from 'axios';
import api from './axiosConfig';
import {
    GetLogsResponse,
    GetLogsByCategoryResponse,
    DeleteLogsResponse,
    ArchiveLogsResponse,
    LogStatisticsResponse,
    ExportLogsResponse,
    ClearLogsResponse,
    UniqueValuesResponse,
    LoggerHealthResponse,
    AxiosErrorResponse,
} from './index';

const handleApiError = (error: unknown, defaultMessage: string): string => {
    if (error instanceof AxiosError) {
        const axiosError = error as AxiosError<AxiosErrorResponse>;
        if (axiosError.response) {
            return axiosError.message;
        }
        switch (axiosError.status) {
            case 400:
                return 'Invalid request. Please check your input and try again.';
            case 401:
                return 'Authentication failed. Please log in again.';
            case 403:
                return 'You don’t have permission to perform this action.';
            case 404:
                return 'Resource not found.';
            case 429:
                return 'API quota exceeded. Please try again later.';
            case 500:
                return 'Something went wrong on our end. Please try again later.';
            default:
                return defaultMessage;
        }
    }
    return defaultMessage;
};

export const getLogs = async (params: {
    page?: number;
    pageSize?: number;
    level?: string;
    route?: string;
    service?: string;
    status?: number;
    method?: string;
    userId?: string;
    traceId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}): Promise<GetLogsResponse> => {
    try {
        const response = await api.get<GetLogsResponse>('/logs', { params });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to fetch logs.'));
    }
};

export const getLogsByCategory = async (
    category: string,
    params: {
        startDate?: string;
        endDate?: string;
        level?: string;
        route?: string;
        service?: string;
    }
): Promise<GetLogsByCategoryResponse> => {
    try {
        if (!['level', 'route', 'service', 'status', 'method'].includes(category)) {
            throw new Error('Invalid category.');
        }
        const response = await api.get<GetLogsByCategoryResponse>(`/logs/category/${category}`, { params });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, `Unable to fetch logs by category ${category}.`));
    }
};

export const deleteLogs = async (data: {
    level?: string;
    route?: string;
    service?: string;
    status?: number;
    method?: string;
    userId?: string;
    traceId?: string;
    startDate?: string;
    endDate?: string;
}): Promise<DeleteLogsResponse> => {
    try {
        const response = await api.post<DeleteLogsResponse>('/logs/delete', data);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to delete logs.'));
    }
};

export const archiveLogs = async (retentionDays?: number): Promise<ArchiveLogsResponse> => {
    try {
        const response = await api.post<ArchiveLogsResponse>('/logs/archive', { retentionDays });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to archive logs.'));
    }
};

export const getLogStatistics = async (params: {
    startDate?: string;
    endDate?: string;
    route?: string;
    service?: string;
    level?: string;
}): Promise<LogStatisticsResponse> => {
    try {
        const response = await api.get<LogStatisticsResponse>('/logs/statistics', { params });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to fetch log statistics.'));
    }
};

export const exportLogs = async (params: {
    level?: string;
    route?: string;
    service?: string;
    status?: number;
    startDate?: string;
    endDate?: string;
}): Promise<ExportLogsResponse> => {
    try {
        const response = await api.get<ExportLogsResponse>('/logs/export', { params });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to export logs.'));
    }
};

export const clearAllLogs = async (): Promise<ClearLogsResponse> => {
    try {
        const response = await api.post<ClearLogsResponse>('/logs/clear');
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to clear all logs.'));
    }
};

export const getUniqueValues = async (field: string): Promise<UniqueValuesResponse> => {
    try {
        if (!['level', 'route', 'service', 'status', 'method', 'userId'].includes(field)) {
            throw new Error('Invalid field.');
        }
        const response = await api.get<UniqueValuesResponse>(`/logs/unique/${field}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, `Unable to fetch unique values for ${field}.`));
    }
};

export const getLoggerHealth = async (): Promise<LoggerHealthResponse> => {
    try {
        const response = await api.get<LoggerHealthResponse>('/logs/health');
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to fetch logger health.'));
    }
};

export const getLoggerMetrics = async (): Promise<string> => {
    try {
        const response = await api.get<string>('/logs/metrics', { responseType: 'text' });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to fetch logger metrics.'));
    }
};