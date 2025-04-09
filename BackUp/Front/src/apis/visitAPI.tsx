import api from "./axiosConfig";
import { VerifyQrResponse, LogVisitResponse, VisitByIdResponse, UpdateVisitResponse, DeleteVisitResponse } from ".";

export const verifyQrCode = async (data: { qrData: string; visitId: string }, token: string): Promise<VerifyQrResponse> => {
    try {
        const response = await api.post<VerifyQrResponse>("/visits/verify-qr", data, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error verifying QR code for visit (${data.visitId}):`, error);
        throw error;
    }
};

export const logVisitDetails = async (
    id: string,
    data: {
        duration: number;
        checklistUpdates: Array<{ checklistID: string; checked: boolean }>;
        photos: File[];
        comment?: string;
    },
    token: string
): Promise<LogVisitResponse> => {
    try {
        const formData = new FormData();
        if (data.duration) formData.append('duration', data.duration.toString());
        if (data.checklistUpdates) formData.append('checklistUpdates', JSON.stringify(data.checklistUpdates));
        if (data.comment) formData.append('comment', data.comment);
        data.photos.forEach((photo) => formData.append('photos', photo));

        for (const [key, value] of formData.entries()) {
            console.log(`FormData entry: ${key}=${value instanceof File ? value.name : value}`);
        }

        const response = await api.put<LogVisitResponse>(`/visits/${id}/log`, formData, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error(`Error logging visit details (${id}):`, error);
        throw error;
    }
};

export const getVisitById = async (id: string, token: string): Promise<VisitByIdResponse> => {
    try {
        const response = await api.get<VisitByIdResponse>(`/visits/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching visit by ID (${id}):`, error);
        throw error;
    }
};

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
        supervisorID?: string; // Add this
    },
    token: string
): Promise<UpdateVisitResponse> => {
    try {
        const formData = new FormData();
        if (data.date) formData.append('date', data.date);
        if (data.time) formData.append('time', data.time);
        if (data.duration !== undefined) formData.append('duration', data.duration.toString());
        if (data.location) formData.append('location', data.location);
        if (data.status) formData.append('status', data.status);
        if (data.comment !== undefined) formData.append('comment', data.comment);
        if (data.agentID) formData.append('agentID', data.agentID);
        if (data.checklists) formData.append('checklists', JSON.stringify(data.checklists));
        if (data.reasons) formData.append('reasons', JSON.stringify(data.reasons));
        if (data.photosToRemove) formData.append('photosToRemove', JSON.stringify(data.photosToRemove));
        if (data.supervisorID) formData.append('supervisorID', data.supervisorID); // Add this
        if (data.photos) {
            data.photos.forEach((photo) => formData.append('photos', photo));
        }

        const response = await api.put<UpdateVisitResponse>(`/visits/${id}`, formData, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error(`Error updating visit (${id}):`, error);
        throw error;
    }
};

export const deleteVisit = async (id: string, token: string): Promise<DeleteVisitResponse> => {
    try {
        const response = await api.delete<DeleteVisitResponse>(`/visits/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error deleting visit (${id}):`, error);
        throw error;
    }
};