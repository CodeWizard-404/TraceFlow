import api from "./axiosConfig"; // Use the shared instance
import { CreateChecklistResponse, ListChecklistsResponse, ChecklistsByVisitResponse } from ".";

export const createChecklist = async (data: { text: string }): Promise<CreateChecklistResponse> => {
    try {
        const response = await api.post<CreateChecklistResponse>("/checklists", data);
        return response.data;
    } catch (error) {
        console.error("Error creating checklist:", error);
        throw error;
    }
};

export const getAllChecklists = async (): Promise<ListChecklistsResponse> => {
    try {
        const response = await api.get<ListChecklistsResponse>("/checklists");
        return response.data;
    } catch (error) {
        console.error("Error fetching all checklists:", error);
        throw error;
    }
};

export const getChecklistsByVisitId = async (visitId: string): Promise<ChecklistsByVisitResponse> => {
    try {
        const response = await api.get<ChecklistsByVisitResponse>(`/checklists/${visitId}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching checklists for visit (${visitId}):`, error);
        throw error;
    }
};