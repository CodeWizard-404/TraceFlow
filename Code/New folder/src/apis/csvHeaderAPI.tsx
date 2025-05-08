import { AxiosError } from "axios";
import api from "./axiosConfig";

// Interface for CSV header
export interface CsvHeader {
    headerID: string;
    csvType: string;
    expectedHeader: string;
    mappedHeader: string;
}

// Interface for get headers response
export interface GetCsvHeadersResponse {
    headers: CsvHeader[];
}

// Interface for update headers response
export interface UpdateCsvHeadersResponse {
    message: string;
}

// Generic error handler
const handleApiError = (error: unknown, defaultMessage: string): string => {
    const axiosError = error as AxiosError;
    if (axiosError.response) {
        return axiosError.message || defaultMessage;
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

// Get CSV headers
export const getCsvHeaders = async (csvType: string = 'agent'): Promise<GetCsvHeadersResponse> => {
    try {
        const response = await api.get<GetCsvHeadersResponse>("/csv-headers", {
            params: { csvType },
        });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch CSV headers."));
    }
};

// Update CSV headers
export const updateCsvHeaders = async (
    csvType: string,
    headers: Array<{ expectedHeader: string; mappedHeader: string }>
): Promise<UpdateCsvHeadersResponse> => {
    try {
        const response = await api.put<UpdateCsvHeadersResponse>("/csv-headers", { csvType, headers });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to update CSV headers."));
    }
};