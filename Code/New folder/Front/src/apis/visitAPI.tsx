import { AxiosError } from "axios";
import api from "./axiosConfig";
import { VisitByIdResponse, UpdateVisitResponse, DeleteVisitResponse } from ".";

// Updated VerifyQrResponse to remove otpID
export type VerifyQrResponse = {
    valid: boolean;
    message: string;
};

// ValidateOTPResponse type
export type ValidateOTPResponse = {
    valid: boolean;
    message: string;
};

// Existing types for other responses
export type LogVisitResponse = {
    visitID: string;
    date: string;
    time: string;
    duration?: number;
    location?: string;
    status: string;
    photos?: string[];
    comment?: string;
    agentID?: string;
    timesheetID: string;
    checklists?: Array<{ checklistID: string; checked: boolean }>;
};

export type CalendarEvent = {
    id: string;
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
};


export type SyncCalendarResponse = CalendarEvent;

export type DeleteCalendarResponse = {
    message: string;
};

interface AxiosErrorResponse {
    response?: {
        data?: { error?: string };
        status?: number;
    };
}

const handleApiError = (error: unknown, defaultMessage: string): string => {
    if (error instanceof AxiosError) {
        const axiosError = error as AxiosError<AxiosErrorResponse>;
        if (axiosError.response) {
            return axiosError.message; // Use backend's error message
        }
        switch (axiosError.status) {
            case 400:
                return "Invalid request. Please check your input and try again.";
            case 401:
                return "Authentication failed. Please log in again.";
            case 403:
                return "You don’t have permission to perform this action.";
            case 404:
                return "Visit or calendar event not found.";
            case 429:
                return "API quota exceeded. Please try again later.";
            case 500:
                return "Something went wrong on our end. Please try again later.";
            default:
                return defaultMessage;
        }
    }
    return defaultMessage;
};

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

export const validateOTP = async (data: { visitId: string; otpCode: string }): Promise<ValidateOTPResponse> => {
    try {
        if (!data.visitId || !data.otpCode) {
            throw new Error("Visit ID and OTP code are required.");
        }
        const response = await api.post<ValidateOTPResponse>(`/visits/${data.visitId}/validate-otp`, {
            visitId: data.visitId,
            otpCode: data.otpCode,
        });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to validate OTP."));
    }
};

export const logVisitDetails = async (
    id: string,
    data: {
        duration: number;
        checklistUpdates: Array<{ checklistID: string; checked: boolean }>;
        photos: File[];
        comment?: string;
        date?: string;
        time?: string;
    }
): Promise<LogVisitResponse> => {
    try {
        if (!id) {
            throw new Error("Visit ID is required.");
        }
        if (!data.photos || data.photos.length === 0) {
            throw new Error("At least one photo is required.");
        }
        if (data.checklistUpdates && !Array.isArray(data.checklistUpdates)) {
            throw new Error("checklistUpdates must be an array.");
        }
        const formData = new FormData();
        formData.append("duration", data.duration.toString());
        formData.append("checklistUpdates", JSON.stringify(data.checklistUpdates));
        if (data.comment) formData.append("comment", data.comment);
        if (data.date) formData.append("date", data.date);
        if (data.time) formData.append("time", data.time);
        data.photos.forEach((photo) => {
            formData.append("photos", photo);
        });

        const response = await api.put<LogVisitResponse>(`/visits/${id}/log`, formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to log visit details."));
    }
};

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

export const updateVisit = async (
    id: string,
    data: {
        date?: string;
        time?: string;
        duration?: number;
        location?: string | null;
        status?: string;
        comment?: string;
        agentID?: string | null;
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
        if (data.location !== undefined) formData.append("location", data.location ?? "");
        if (data.status) formData.append("status", data.status);
        if (data.comment !== undefined) formData.append("comment", data.comment);
        if (data.agentID !== undefined) formData.append("agentID", data.agentID ?? "");
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

export const syncVisitToCalendar = async (visitId: string): Promise<SyncCalendarResponse> => {
    try {
        if (!visitId) {
            throw new Error("Visit ID is required.");
        }
        const response = await api.post<SyncCalendarResponse>(`/visits/${visitId}/sync-calendar`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to sync visit to calendar."));
    }
};

