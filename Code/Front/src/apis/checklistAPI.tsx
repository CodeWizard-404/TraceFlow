import { AxiosError } from "axios";
import api from "./axiosConfig";
import { CreateChecklistResponse, ListChecklistsResponse, ChecklistsByVisitResponse, ChecklistByIdResponse, UpdateChecklistResponse, DeleteChecklistResponse } from ".";

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

// Create a new checklist
export const createChecklist = async (data: { text: string }): Promise<CreateChecklistResponse> => {
    try {
        if (!data.text) {
            throw new Error("Checklist text is required.");
        }
        const response = await api.post<CreateChecklistResponse>("/checklists", data);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to create checklist."));
    }
};

// Get checklist by ID
export const getChecklistById = async (checklistId: string): Promise<ChecklistByIdResponse> => {
    try {
        if (!checklistId) {
            throw new Error("Checklist ID is required.");
        }
        const response = await api.get<ChecklistByIdResponse>(`/checklists/${checklistId}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Checklist not found."));
    }
};

// Update a checklist
export const updateChecklist = async (checklistId: string, data: { text: string }): Promise<UpdateChecklistResponse> => {
    try {
        if (!checklistId || !data.text) {
            throw new Error("Checklist ID and text are required.");
        }
        const response = await api.put<UpdateChecklistResponse>(`/checklists/${checklistId}`, data);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to update checklist."));
    }
};

// Delete a checklist
export const deleteChecklist = async (checklistId: string): Promise<DeleteChecklistResponse> => {
    try {
        if (!checklistId) {
            throw new Error("Checklist ID is required.");
        }
        const response = await api.delete<DeleteChecklistResponse>(`/checklists/${checklistId}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to delete checklist."));
    }
};

// Get all checklists
export const getAllChecklists = async (): Promise<ListChecklistsResponse> => {
    try {
        const response = await api.get<ListChecklistsResponse>("/checklists");
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch all checklists."));
    }
};

// Get checklists by visit ID
export const getChecklistsByVisitId = async (visitId: string): Promise<ChecklistsByVisitResponse> => {
    try {
        if (!visitId) {
            throw new Error("Visit ID is required.");
        }
        const response = await api.get<ChecklistsByVisitResponse>(`/checklists/visit/${visitId}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch checklists for visit."));
    }
};