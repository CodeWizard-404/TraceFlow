import api from "./axiosConfig";
import { CreateTimesheetResponse, ListTimesheetsResponse, TimesheetByIdResponse, ValidateTimesheetResponse, TimesheetsBySupervisorResponse, DeleteTimesheetResponse } from ".";

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
    const response = await api.post<CreateTimesheetResponse>("/timesheets/supervisor", data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("switching to manager route:", error);
    try {
      const fallbackResponse = await api.post<CreateTimesheetResponse>("/timesheets/manager", data, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return fallbackResponse.data;
    } catch (fallbackError) {
      console.error("Error creating timesheet :", fallbackError);
      throw fallbackError;
    }
  }
};

export const updateTimesheet = async (
  id: string,
  data: {
    weekNumber?: number;
    year?: number;
    status?: string;
    visits?: Array<{
      visitID?: string;
      date?: string;
      time?: string;
      duration?: number;
      location?: string;
      status?: string;
      comment?: string;
      photos?: File[];
    }>;
  },
  token: string
): Promise<TimesheetByIdResponse> => {
  try {
    const formData = new FormData();
    if (data.weekNumber) formData.append('weekNumber', data.weekNumber.toString());
    if (data.year) formData.append('year', data.year.toString());
    if (data.status) formData.append('status', data.status);

    if (data.visits) {
      const visitsData = data.visits.map(visit => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const visitObj: any = { ...visit };
        delete visitObj.photos; // Remove photos from JSON
        return visitObj;
      });
      formData.append('visits', JSON.stringify(visitsData));

      data.visits.forEach((visit) => {
        if (visit.photos && visit.visitID) {
          visit.photos.forEach((photo) => {
            formData.append(`photos.${visit.visitID}`, photo);
          });
        }
      });
    }

    const response = await api.put<TimesheetByIdResponse>(`/timesheets/${id}`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error updating timesheet (${id}):`, error);
    throw error;
  }
};

export const deleteTimesheet = async (id: string, token: string): Promise<DeleteTimesheetResponse> => {
  try {
    const response = await api.delete<DeleteTimesheetResponse>(`/timesheets/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error deleting timesheet (${id}):`, error);
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