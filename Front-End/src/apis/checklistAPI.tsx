import api from "./axiosConfig";
import { CreateChecklistResponse, ListChecklistsResponse, ChecklistsByVisitResponse, ChecklistByIdResponse, UpdateChecklistResponse } from ".";

export const createChecklist = async (data: { text: string }, token: string): Promise<CreateChecklistResponse> => {
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

export const getChecklistById = async (checklistId: string, token: string): Promise<ChecklistByIdResponse> => {
    try {
        const response = await api.get<ChecklistByIdResponse>(`/checklists/${checklistId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching checklist (${checklistId}):`, error);
        throw error;
    }
};

export const updateChecklist = async (checklistId: string, data: { text: string }, token: string): Promise<UpdateChecklistResponse> => {
    try {
        const response = await api.put<UpdateChecklistResponse>(`/checklists/${checklistId}`, data, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error updating checklist (${checklistId}):`, error);
        throw error;
    }
};

export const deleteChecklist = async (checklistId: string, token: string): Promise<void> => {
    try {
        await api.delete(`/checklists/${checklistId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
    } catch (error) {
        console.error(`Error deleting checklist (${checklistId}):`, error);
        throw error;
    }
};

export const getAllChecklists = async (token: string): Promise<ListChecklistsResponse> => {
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

export const getChecklistsByVisitId = async (visitId: string, token: string): Promise<ChecklistsByVisitResponse> => {
    try {
        const response = await api.get<ChecklistsByVisitResponse>(`/checklists/visit/${visitId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching checklists for visit (${visitId}):`, error);
        throw error;
    }
};