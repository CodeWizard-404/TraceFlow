import api from "./axiosConfig";
import { VerifyQrResponse, LogVisitResponse, VisitByIdResponse } from ".";



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