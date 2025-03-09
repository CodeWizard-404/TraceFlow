// src/api/reasonApi.tsx
import axios from "axios";
import { CreateReasonResponse, ListReasonsResponse, ReasonsByVisitResponse } from ".";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";

const reasonApi = axios.create({
    baseURL: `${BASE_URL}/reasons`,
    timeout: DEFAULT_TIMEOUT,
});

export const createReason = async (data: { text: string }): Promise<CreateReasonResponse> => {
    const response = await reasonApi.post<CreateReasonResponse>("", data);
    return response.data;
};

export const getAllReasons = async (): Promise<ListReasonsResponse> => {
    const response = await reasonApi.get<ListReasonsResponse>("");
    return response.data;
};

export const getReasonsByVisitId = async (visitId: string): Promise<ReasonsByVisitResponse> => {
    const response = await reasonApi.get<ReasonsByVisitResponse>(`/${visitId}`);
    return response.data;
};