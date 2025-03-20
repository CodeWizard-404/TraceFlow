import api from "./axiosConfig";
import { CreateChecklistResponse, ListChecklistsResponse, ChecklistsByVisitResponse } from ".";

export const createChecklist = async (data: { text: string } , token: string): Promise<CreateChecklistResponse> => {
    try {
        const response = await api.post<CreateChecklistResponse>("/checklists", data, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error("Error creating checklist:", error);
        throw error;
    }
};

export const getAllChecklists = async ( token: string): Promise<ListChecklistsResponse> => {
    try {
        const response = await api.get<ListChecklistsResponse>("/checklists", {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching all checklists:", error);
        throw error;
    }
};

export const getChecklistsByVisitId = async (visitId: string , token: string): Promise<ChecklistsByVisitResponse> => {
    try {
        const response = await api.get<ChecklistsByVisitResponse>(`/checklists/${visitId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching checklists for visit (${visitId}):`, error);
        throw error;
    }
};