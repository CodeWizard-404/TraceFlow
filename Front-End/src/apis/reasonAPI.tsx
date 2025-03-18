import api from "./axiosConfig"; // Use the shared instance
import { CreateReasonResponse, ListReasonsResponse, ReasonsByVisitResponse } from ".";

export const createReason = async (data: { text: string }): Promise<CreateReasonResponse> => {
    try {
        const response = await api.post<CreateReasonResponse>("/reasons", data);
        return response.data;
    } catch (error) {
        console.error("Error creating reason:", error);
        throw error;
    }
};

export const getAllReasons = async (): Promise<ListReasonsResponse> => {
    try {
        const response = await api.get<ListReasonsResponse>("/reasons");
        return response.data;
    } catch (error) {
        console.error("Error fetching all reasons:", error);
        throw error;
    }
};

export const getReasonsByVisitId = async (visitId: string): Promise<ReasonsByVisitResponse> => {
    try {
        const response = await api.get<ReasonsByVisitResponse>(`/reasons/${visitId}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching reasons for visit (${visitId}):`, error);
        throw error;
    }
};