import api from "./axiosConfig";
import { CreateTimesheetResponse, ListTimesheetsResponse, TimesheetByIdResponse, ValidateTimesheetResponse, TimesheetsBySupervisorResponse } from ".";


export const createTimesheet = async (
  data: {
    weekNumber: number;
    year: number;
    supervisorID: string;
    visits: Array<{
      date: string;
      time: string;
      agentID: string;
      reasons: Array<{ text?: string; id?: string }>;
      checklists: Array<{ text?: string; id?: string }>;
    }>;
    status?: string;
  },
  token: string
): Promise<CreateTimesheetResponse> => {
  try {
    const response = await api.post<CreateTimesheetResponse>("/timesheets", data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error creating timesheet:", error);
    throw error;
  }
};

export const getAllTimesheets = async (token: string): Promise<ListTimesheetsResponse> => {
  try {
    const response = await api.get<ListTimesheetsResponse>("/timesheets", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching all timesheets:", error);
    throw error;
  }
};

export const getTimesheetById = async (id: string, token: string): Promise<TimesheetByIdResponse> => {
  try {
    const response = await api.get<TimesheetByIdResponse>(`/timesheets/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching timesheet by ID (${id}):`, error);
    throw error;
  }
};

export const validateTimesheet = async (
  id: string,
  data: { visitIDs: string[]; status: string },
  token: string
): Promise<ValidateTimesheetResponse> => {
  try {
    const response = await api.put<ValidateTimesheetResponse>(`/timesheets/${id}/validate`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error validating timesheet (${id}):`, error);
    throw error;
  }
};

export const getTimesheetsBySupervisor = async (supervisorID: string, token: string): Promise<TimesheetsBySupervisorResponse> => {
  try {
    const response = await api.get<TimesheetsBySupervisorResponse>(`/timesheets/supervisor/${supervisorID}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching timesheets for supervisor (${supervisorID}):`, error);
    throw error;
  }
};