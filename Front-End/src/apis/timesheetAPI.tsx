import axios from "axios";
import { CreateTimesheetResponse, ListTimesheetsResponse, TimesheetByIdResponse, ValidateTimesheetResponse, TimesheetsBySupervisorResponse } from ".";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";

const timesheetApi = axios.create({
  baseURL: `${BASE_URL}/timesheets`,
  timeout: DEFAULT_TIMEOUT,
});

export const createTimesheet = async (data: {
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
}): Promise<CreateTimesheetResponse> => {
  const response = await timesheetApi.post<CreateTimesheetResponse>("", data);
  return response.data;
};

export const getAllTimesheets = async (): Promise<ListTimesheetsResponse> => {
  const response = await timesheetApi.get<ListTimesheetsResponse>("");
  return response.data;
};

export const getTimesheetById = async (id: string): Promise<TimesheetByIdResponse> => {
  const response = await timesheetApi.get<TimesheetByIdResponse>(`/${id}`);
  return response.data;
};

export const validateTimesheet = async (
  id: string,
  data: { visitIDs: string[]; status: string }
): Promise<ValidateTimesheetResponse> => {
  const response = await timesheetApi.put<ValidateTimesheetResponse>(`/${id}/validate`, data);
  return response.data;
};

export const getTimesheetsBySupervisor = async (supervisorID: string): Promise<TimesheetsBySupervisorResponse> => {
  const response = await timesheetApi.get<TimesheetsBySupervisorResponse>(`/supervisor/${supervisorID}`);
  return response.data;
};