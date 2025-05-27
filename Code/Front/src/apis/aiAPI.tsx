import { AxiosError } from 'axios';
import api from './axiosConfig';
import { AxiosErrorResponse } from './index';
import { AIConfig, Anomaly, TimesheetSuggestion } from '../models/AI';

// AI Response Types



// Request Types
export interface CreateAIConfigRequest {
    modelName: string;
    anomalyThreshold: number;
    timesheetMaxSuggestions: number;
    supervisorId?: string;
}

export interface UpdateAIConfigRequest {
    modelName?: string;
    anomalyThreshold?: number;
    timesheetMaxSuggestions?: number;
}

export interface GetAIConfigRequest {
    configID?: string;
    supervisorId?: string;
}

export interface ListAIConfigsRequest {
    supervisorId?: string;
}

export interface SuggestTimesheetRequest {
    supervisorId: string;
    weekStart: string;
    criteria: {
        delegationIds?: string[];
        agentIds?: string[];
        preferredDays?: string[];
        timeInterval?: { startHour: number; endHour: number };
        maxVisitsPerAgentPerWeek?: number;
        includeRecruitmentVisits?: boolean;
        coordinates?: { lat: number; lng: number };
        recruitmentAreas?: string[];
    };
}

export interface DetectAnomaliesRequest {
    dataType: 'timesheet' | 'visit' | 'receipt';
    data: any[];
}

export interface GenerateReportRequest {
    filters: Record<string, any>;
    format: 'pdf' | 'excel';
}

// Response Types
export interface CreateAIConfigResponse extends AIConfig { }

export interface UpdateAIConfigResponse extends AIConfig { }

export interface GetAIConfigResponse extends AIConfig { }

export interface DeleteAIConfigResponse {
    message: string;
    configID: string;
}

export interface ListAIConfigsResponse extends Array<AIConfig> { }

export interface TestAIConfigResponse {
    configID: string;
    status: string;
    response: Record<string, any>;
}

export interface SuggestTimesheetResponse {
    suggestions: TimesheetSuggestion[];
}

export interface DetectAnomaliesResponse {
    anomalies: Anomaly[];
}

export interface GenerateReportResponse {
    report: Report;
}

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

export const createAIConfig = async (data: CreateAIConfigRequest): Promise<CreateAIConfigResponse> => {
    try {
        const response = await api.post<CreateAIConfigResponse>('/ai/config', data);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to create AI configuration.'));
    }
};

export const updateAIConfig = async (configID: string, data: UpdateAIConfigRequest): Promise<UpdateAIConfigResponse> => {
    try {
        const response = await api.put<UpdateAIConfigResponse>(`/ai/config/${configID}`, data);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to update AI configuration.'));
    }
};

export const getAIConfig = async (params: GetAIConfigRequest): Promise<GetAIConfigResponse> => {
    try {
        const response = await api.get<GetAIConfigResponse>('/ai/config', { params });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to fetch AI configuration.'));
    }
};

export const deleteAIConfig = async (configID: string): Promise<DeleteAIConfigResponse> => {
    try {
        const response = await api.delete<DeleteAIConfigResponse>(`/ai/config/${configID}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to delete AI configuration.'));
    }
};

export const listAIConfigs = async (params: ListAIConfigsRequest): Promise<ListAIConfigsResponse> => {
    try {
        const response = await api.get<ListAIConfigsResponse>('/ai/configs', { params });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to fetch AI configurations.'));
    }
};

export const testAIConfig = async (configID: string): Promise<TestAIConfigResponse> => {
    try {
        const response = await api.post<TestAIConfigResponse>(`/ai/config/${configID}/test`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to test AI configuration.'));
    }
};

export const suggestTimesheet = async (data: SuggestTimesheetRequest): Promise<SuggestTimesheetResponse> => {
    try {
        const response = await api.post<SuggestTimesheetResponse>('/ai/timesheet/suggest', data);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to generate timesheet suggestions.'));
    }
};

export const detectAnomalies = async (data: DetectAnomaliesRequest): Promise<DetectAnomaliesResponse> => {
    try {
        const response = await api.post<DetectAnomaliesResponse>('/ai/anomaly/detect', data);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to detect anomalies.'));
    }
};

export const generateReport = async (data: GenerateReportRequest): Promise<GenerateReportResponse> => {
    try {
        const response = await api.post<GenerateReportResponse>('/ai/report/generate', data);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to generate report.'));
    }
};