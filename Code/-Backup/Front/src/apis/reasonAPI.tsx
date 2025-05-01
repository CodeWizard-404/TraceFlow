import { AxiosError } from "axios";
import api from "./axiosConfig";
import { CreateReasonResponse, ListReasonsResponse, ReasonByIdResponse, ReasonsByVisitResponse, UpdateReasonResponse, DeleteReasonResponse } from ".";

// Error response type for Axios errors
interface AxiosErrorResponse {
    response?: {
        data?: { error?: string };
        status?: number;
    };
}

// Generic error handler
const handleApiError = (error: unknown, defaultMessage: string): string => {
    const axiosError = error as AxiosError<AxiosErrorResponse>;
    if (axiosError.response?.data) {
        return axiosError.message; // Use backend's user-friendly error
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

// Create a new reason
export const createReason = async (data: { text: string }): Promise<CreateReasonResponse> => {
    try {
        if (!data.text) {
            throw new Error("Reason text is required.");
        }
        const response = await api.post<CreateReasonResponse>("/reasons", data);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to create reason."));
    }
};

// Get reason by ID
export const getReasonById = async (reasonId: string): Promise<ReasonByIdResponse> => {
    try {
        if (!reasonId) {
            throw new Error("Reason ID is required.");
        }
        const response = await api.get<ReasonByIdResponse>(`/reasons/${reasonId}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Reason not found."));
    }
};

// Update a reason
export const updateReason = async (reasonId: string, data: { text: string }): Promise<UpdateReasonResponse> => {
    try {
        if (!reasonId || !data.text) {
            throw new Error("Reason ID and text are required.");
        }
        const response = await api.put<UpdateReasonResponse>(`/reasons/${reasonId}`, data);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to update reason."));
    }
};

// Delete a reason
export const deleteReason = async (reasonId: string): Promise<DeleteReasonResponse> => {
    try {
        if (!reasonId) {
            throw new Error("Reason ID is required.");
        }
        const response = await api.delete<DeleteReasonResponse>(`/reasons/${reasonId}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to delete reason."));
    }
};

// Get all reasons
export const getAllReasons = async (): Promise<ListReasonsResponse> => {
    try {
        const response = await api.get<ListReasonsResponse>("/reasons");
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch all reasons."));
    }
};

// Get reasons by visit ID
export const getReasonsByVisitId = async (visitId: string): Promise<ReasonsByVisitResponse> => {
    try {
        if (!visitId) {
            throw new Error("Visit ID is required.");
        }
        const response = await api.get<ReasonsByVisitResponse>(`/reasons/visit/${visitId}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch reasons for visit."));
    }
};