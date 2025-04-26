import { AxiosError } from "axios";
import api from "./axiosConfig";
import { VerifyQrResponse, LogVisitResponse, VisitByIdResponse, UpdateVisitResponse, DeleteVisitResponse } from ".";

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
            return "Visit not found.";
        case 500:
            return "Something went wrong on our end. Please try again later.";
        default:
            return defaultMessage;
    }
};

// Verify QR code for a visit
export const verifyQrCode = async (data: { qrData: string; visitId: string }): Promise<VerifyQrResponse> => {
    try {
        if (!data.qrData || !data.visitId) {
            throw new Error("QR data and visit ID are required.");
        }
        const response = await api.post<VerifyQrResponse>("/visits/verify-qr", data);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to verify QR code."));
    }
};

// Log visit details
export const logVisitDetails = async (
    id: string,
    data: {
        duration: number;
        checklistUpdates: Array<{ checklistID: string; checked: boolean }>;
        photos: File[];
        comment?: string;
    }
): Promise<LogVisitResponse> => {
    try {
        if (!id) {
            throw new Error("Visit ID is required.");
        }
        const formData = new FormData();
        if (data.duration) formData.append("duration", data.duration.toString());
        if (data.checklistUpdates) formData.append("checklistUpdates", JSON.stringify(data.checklistUpdates));
        if (data.comment) formData.append("comment", data.comment);
        data.photos.forEach((photo) => {
            console.log("Appending photo:", photo.name, photo.size); // Log each photo
            formData.append("photos", photo);
        });

        // Log all FormData entries
        console.log("FormData entries:");
        for (const [key, value] of formData.entries()) {
            console.log(`${key}:`, value instanceof File ? `${value.name} (${value.size} bytes)` : value);
        }

        const response = await api.put<LogVisitResponse>(`/visits/${id}/log`, formData);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to log visit details."));
    }
};
// Get visit by ID
export const getVisitById = async (id: string): Promise<VisitByIdResponse> => {
    try {
        if (!id) {
            throw new Error("Visit ID is required.");
        }
        const response = await api.get<VisitByIdResponse>(`/visits/${id}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Visit not found."));
    }
};

// Update visit details
export const updateVisit = async (
    id: string,
    data: {
        date?: string;
        time?: string;
        duration?: number;
        location?: string;
        status?: string;
        comment?: string;
        agentID?: string;
        checklists?: Array<{ id: string; checked?: boolean }>;
        reasons?: Array<{ id: string }>;
        photos?: File[];
        photosToRemove?: string[];
        supervisorID?: string;
    }
): Promise<UpdateVisitResponse> => {
    try {
        if (!id) {
            throw new Error("Visit ID is required.");
        }
        const formData = new FormData();
        if (data.date) formData.append("date", data.date);
        if (data.time) formData.append("time", data.time);
        if (data.duration !== undefined) formData.append("duration", data.duration.toString());
        if (data.location) formData.append("location", data.location);
        if (data.status) formData.append("status", data.status);
        if (data.comment !== undefined) formData.append("comment", data.comment);
        if (data.agentID) formData.append("agentID", data.agentID);
        if (data.checklists) formData.append("checklists", JSON.stringify(data.checklists));
        if (data.reasons) formData.append("reasons", JSON.stringify(data.reasons));
        if (data.photosToRemove) formData.append("photosToRemove", JSON.stringify(data.photosToRemove));
        if (data.supervisorID) formData.append("supervisorID", data.supervisorID);
        if (data.photos) {
            data.photos.forEach((photo) => formData.append("photos", photo));
        }

        const response = await api.put<UpdateVisitResponse>(`/visits/${id}`, formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to update visit."));
    }
};

// Delete a visit
export const deleteVisit = async (id: string): Promise<DeleteVisitResponse> => {
    try {
        if (!id) {
            throw new Error("Visit ID is required.");
        }
        const response = await api.delete<DeleteVisitResponse>(`/visits/${id}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to delete visit."));
    }
};