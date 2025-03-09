import axios from "axios";
import { CreateVisitResponse, VerifyQrResponse, LogVisitResponse, VisitByIdResponse } from ".";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";

const visitApi = axios.create({
    baseURL: `${BASE_URL}/visits`,
    timeout: DEFAULT_TIMEOUT,
});

export const createVisit = async (data: {
    timesheetID: string;
    supervisorID: string;
    date: string;
    time: string;
    agentID: string;
    reasons: Array<{ text?: string; id?: string }>;
    checklists: Array<{ text?: string; id?: string }>;
}): Promise<CreateVisitResponse> => {
    const response = await visitApi.post<CreateVisitResponse>("", data);
    return response.data;
};

export const verifyQrCode = async (data: { qrData: string; visitId: string }): Promise<VerifyQrResponse> => {
    const response = await visitApi.post<VerifyQrResponse>("/verify-qr", data);
    return response.data;
};

export const logVisitDetails = async (
    id: string,
    data: { duration: number; checklistUpdates: Array<{ checklistID: string; checked: boolean }> }
): Promise<LogVisitResponse> => {
    const response = await visitApi.put<LogVisitResponse>(`/${id}/log`, data);
    return response.data;
};

export const getVisitById = async (id: string): Promise<VisitByIdResponse> => {
    const response = await visitApi.get<VisitByIdResponse>(`/${id}`);
    return response.data;
};