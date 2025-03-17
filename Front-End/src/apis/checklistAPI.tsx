import axios from "axios";
import { CreateChecklistResponse, ListChecklistsResponse, ChecklistsByVisitResponse } from ".";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";

const checklistApi = axios.create({
    baseURL: `${BASE_URL}/checklists`,
    timeout: DEFAULT_TIMEOUT,
});

export const createChecklist = async (data: { text: string }, token: string): Promise<CreateChecklistResponse> => {
    try {
        const response = await checklistApi.post<CreateChecklistResponse>("", data, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error("Error creating checklist:", error);
        throw error;
    }
};

export const getAllChecklists = async (token?: string): Promise<ListChecklistsResponse> => {
    try {
        const response = await checklistApi.get<ListChecklistsResponse>("", {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching all checklists:", error);
        throw error;
    }
};

export const getChecklistsByVisitId = async (visitId: string, token: string): Promise<ChecklistsByVisitResponse> => {
    try {
        const response = await checklistApi.get<ChecklistsByVisitResponse>(`/${visitId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching checklists for visit (${visitId}):`, error);
        throw error;
    }
};