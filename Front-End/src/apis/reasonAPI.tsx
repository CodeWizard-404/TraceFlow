import api from "./axiosConfig";
import { CreateReasonResponse, ListReasonsResponse, ReasonsByVisitResponse } from ".";

export const createReason = async (data: { text: string } , token: string ): Promise<CreateReasonResponse> => {
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

export const getAllReasons = async ( token: string): Promise<ListReasonsResponse> => {
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

export const getReasonsByVisitId = async (visitId: string , token: string): Promise<ReasonsByVisitResponse> => {
    try {
        const response = await api.get<ReasonsByVisitResponse>(`/reasons/${visitId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching reasons for visit (${visitId}):`, error);
        throw error;
    }
};