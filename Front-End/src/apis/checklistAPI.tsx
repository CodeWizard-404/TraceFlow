import axios from "axios";
import { CreateChecklistResponse, ListChecklistsResponse, ChecklistsByVisitResponse } from ".";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";

const checklistApi = axios.create({
    baseURL: `${BASE_URL}/checklists`,
    timeout: DEFAULT_TIMEOUT,
});

export const createChecklist = async (data: { text: string }): Promise<CreateChecklistResponse> => {
    const response = await checklistApi.post<CreateChecklistResponse>("", data);
    return response.data;
};

export const getAllChecklists = async (): Promise<ListChecklistsResponse> => {
    const response = await checklistApi.get<ListChecklistsResponse>("");
    return response.data;
};

export const getChecklistsByVisitId = async (visitId: string): Promise<ChecklistsByVisitResponse> => {
    const response = await checklistApi.get<ChecklistsByVisitResponse>(`/${visitId}`);
    return response.data;
};