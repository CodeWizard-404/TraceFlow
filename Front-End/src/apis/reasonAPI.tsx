import api from "./axiosConfig";
import { CreateReasonResponse, ListReasonsResponse, ReasonByIdResponse, ReasonsByVisitResponse, UpdateReasonResponse } from ".";

export const createReason = async (data: { text: string }, token: string): Promise<CreateReasonResponse> => {
    try {
        const response = await api.post<CreateReasonResponse>("/reasons", data, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error("Error creating reason:", error);
        throw error;
    }
};

export const getReasonById = async (reasonId: string, token: string): Promise<ReasonByIdResponse> => {
    try {
        const response = await api.get<ReasonByIdResponse>(`/reasons/${reasonId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching reason (${reasonId}):`, error);
        throw error;
    }
};

export const updateReason = async (reasonId: string, data: { text: string }, token: string): Promise<UpdateReasonResponse> => {
    try {
        const response = await api.put<UpdateReasonResponse>(`/reasons/${reasonId}`, data, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error updating reason (${reasonId}):`, error);
        throw error;
    }
};

export const deleteReason = async (reasonId: string, token: string): Promise<void> => {
    try {
        await api.delete(`/reasons/${reasonId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
    } catch (error) {
        console.error(`Error deleting reason (${reasonId}):`, error);
        throw error;
    }
};

export const getAllReasons = async (token: string): Promise<ListReasonsResponse> => {
    try {
        const response = await api.get<ListReasonsResponse>("/reasons", {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching all reasons:", error);
        throw error;
    }
};

export const getReasonsByVisitId = async (visitId: string, token: string): Promise<ReasonsByVisitResponse> => {
    try {
        const response = await api.get<ReasonsByVisitResponse>(`/reasons/visit/${visitId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching reasons for visit (${visitId}):`, error);
        throw error;
    }
};