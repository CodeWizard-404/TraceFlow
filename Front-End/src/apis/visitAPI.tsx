import api from "./axiosConfig"; // Use the shared instance
import { CreateVisitResponse, VerifyQrResponse, LogVisitResponse, VisitByIdResponse } from ".";



export const createVisit = async (
    data: {
        timesheetID: string;
        supervisorID: string;
        date: string;
        time: string;
        agentID: string;
        reasons: Array<{ text?: string; id?: string }>;
        checklists: Array<{ text?: string; id?: string }>;
    },
    token: string
): Promise<CreateVisitResponse> => {
    try {
        const response = await api.post<CreateVisitResponse>("/visits", data, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error("Error creating visit:", error);
        throw error;
    }
};

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
    data: { duration: number; checklistUpdates: Array<{ checklistID: string; checked: boolean }> },
    token: string
): Promise<LogVisitResponse> => {
    try {
        const response = await api.put<LogVisitResponse>(`/visits/${id}/log`, data, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error logging visit details (${id}):`, error);
        throw error;
    }
};

export const getVisitById = async (id: string, token: string): Promise<VisitByIdResponse> => {
    try {
        console.log("getVisitById - Sending request with token:", token);
        const response = await api.get<VisitByIdResponse>(`/visits/${id}`, {
            headers: { Authorization: `Bearer ${token}` }, // Still include this for safety
        });
        console.log("getVisitById - Response:", response.status);
        return response.data;
    } catch (error) {
        console.error(`Error fetching visit by ID (${id}):`, error);
        throw error;
    }
};