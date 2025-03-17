import axios from "axios";
import { CreateReasonResponse, ListReasonsResponse, ReasonsByVisitResponse } from ".";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";

const reasonApi = axios.create({
    baseURL: `${BASE_URL}/reasons`,
    timeout: DEFAULT_TIMEOUT,
});

export const createReason = async (data: { text: string }, token: string): Promise<CreateReasonResponse> => {
    try {
        const response = await reasonApi.post<CreateReasonResponse>("", data, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error("Error creating reason:", error);
        throw error;
    }
};

export const getAllReasons = async (token?: string): Promise<ListReasonsResponse> => {
    try {
        const response = await reasonApi.get<ListReasonsResponse>("", {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching all reasons:", error);
        throw error;
    }
};

export const getReasonsByVisitId = async (visitId: string, token: string): Promise<ReasonsByVisitResponse> => {
    try {
        const response = await reasonApi.get<ReasonsByVisitResponse>(`/${visitId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching reasons for visit (${visitId}):`, error);
        throw error;
    }
};