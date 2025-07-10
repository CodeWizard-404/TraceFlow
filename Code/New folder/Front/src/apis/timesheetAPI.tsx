import { AxiosError } from "axios";
import api from "./axiosConfig";
import {
  CreateTimesheetResponse,
  ListTimesheetsResponse,
  TimesheetByIdResponse,
  ValidateTimesheetResponse,
  TimesheetsBySupervisorResponse,
  DeleteTimesheetResponse,
  AxiosErrorResponse,
  TimesheetByWeekNumberAndYearResponse,
} from ".";

// Type for timesheet calendar sync response
export type SyncTimesheetCalendarResponse = Array<{
  visitId: string;
  calendarEventId: string;
  status: "created" | "updated";
}>;

// Type for timesheet suggestions response
export type SuggestTimesheetResponse = Array<{
  visitID: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  location: string;
  status: string;
  photos: string[];
  comment: string | null;
  agentID: string | null;
  timesheetID: string;
  calendarEventId: string | null;
  Reasons: Array<{ reasonID: string; item: string }>;
  Checklists: Array<{ checklistID: string; item: string }>;
  Agent: {
    agentID: string;
    name: string;
    lastname: string;
    email: string;
    phone: string;
    location: string;
    latitude: number | null;
    longitude: number | null;
    supervisorID: string;
    delegationID: string | null;
    Delegation: { delegationID: string; name: string } | null;
  } | null;
}>;

// Type for the raw API response
type SuggestTimesheetApiResponse = {
  suggestions: SuggestTimesheetResponse;
  requestId: string;
};



// Type for cancel timesheet suggestion response
type CancelTimesheetSuggestionResponse = {
  message: string;
};

const handleApiError = (error: unknown, defaultMessage: string): string => {
  const axiosError = error as AxiosError<AxiosErrorResponse>;
  if (axiosError.response) {
    return axiosError.message;
  }
  switch (axiosError.status) {
    case 400:
      return "Invalid request. Please check your input and try again.";
    case 401:
      return "Authentication failed. Please log in again.";
    case 403:
      return "You don’t have permission to perform this action.";
    case 404:
      return "Timesheet or resource not found.";
    case 499:
      return "Request was canceled.";
    case 500:
      return "Something went wrong on our end. Please try again later.";
    case 503:
      return "AI service is unavailable. Try again later.";
    default:
      return defaultMessage;
  }
};

export const createTimesheet = async (data: {
  weekNumber: number;
  year: number;
  supervisorID: string;
  visits: Array<{
    date: string;
    time: string;
    agentID?: string | null;
    location?: string | null;
    reasons?: Array<{ id: string }>;
    checklists?: Array<{ id: string }>;
    status?: string;
  }>;
  status?: string;
}): Promise<CreateTimesheetResponse> => {
  try {
    if (!data.weekNumber || !data.year || !data.supervisorID || !Array.isArray(data.visits)) {
      throw new Error("Week number, year, supervisor ID, and visits array are required.");
    }
    if (data.status && !["pending", "validated"].includes(data.status)) {
      throw new Error("Status must be 'pending' or 'validated'.");
    }
    const response = await api.post<CreateTimesheetResponse>("/timesheets/supervisor", data);
    return response.data;
  } catch (error) {
    const errorMessage = handleApiError(error, "Unable to create timesheet.");
    throw new Error(errorMessage);
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
      location?: string | null;
      status?: string;
      comment?: string;
      photos?: File[];
      agentID?: string | null;
      checklists?: Array<{ id: string }>;
      reasons?: Array<{ id: string }>;
    }>;
  }
): Promise<TimesheetByIdResponse> => {
  try {
    if (!id) {
      throw new Error("Timesheet ID is required.");
    }
    const formData = new FormData();
    if (data.weekNumber) formData.append("weekNumber", data.weekNumber.toString());
    if (data.year) formData.append("year", data.year.toString());
    if (data.status) formData.append("status", data.status);

    if (data.visits) {
      const visitsData = data.visits.map((visit) => {
        const visitObj: Partial<{
          visitID: string;
          date: string;
          time: string;
          duration: number;
          location: string | null;
          status: string;
          comment: string;
          photos: File[];
          agentID: string | null;
          checklists: Array<{ id: string }>;
          reasons: Array<{ id: string }>;
        }> = { ...visit };
        delete visitObj.photos;
        return visitObj;
      });
      formData.append("visits", JSON.stringify(visitsData));

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
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to update timesheet."));
  }
};

export const deleteTimesheet = async (id: string): Promise<DeleteTimesheetResponse> => {
  try {
    if (!id) {
      throw new Error("Timesheet ID is required.");
    }
    const response = await api.delete<DeleteTimesheetResponse>(`/timesheets/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to delete timesheet."));
  }
};

export const getAllTimesheets = async (): Promise<ListTimesheetsResponse> => {
  try {
    const response = await api.get<ListTimesheetsResponse>("/timesheets");
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to fetch all timesheets."));
  }
};

export const getTimesheetById = async (id: string): Promise<TimesheetByIdResponse> => {
  try {
    if (!id) {
      throw new Error("Timesheet ID is required.");
    }
    const response = await api.get<TimesheetByIdResponse>(`/timesheets/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Timesheet not found."));
  }
};

export const getTimesheetByWeekNumberAndYear = async (
  weekNumber: number,
  year: number,
  supervisorID: string
): Promise<TimesheetByWeekNumberAndYearResponse | null> => {
  try {
    if (!weekNumber || !year || !supervisorID) {
      throw new Error("Week number, year, and supervisor ID are required.");
    }
    const response = await api.get<TimesheetByWeekNumberAndYearResponse>(
      `/timesheets/week/${weekNumber}/year/${year}/supervisor/${supervisorID}`
    );
    return response.data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 404) {
      return null;
    }
    throw new Error(handleApiError(error, "Unable to fetch timesheet by week number and year."));
  }
};

export const validateTimesheet = async (
  id: string,
  data: { visitIDs: string[]; status: string }
): Promise<ValidateTimesheetResponse> => {
  try {
    if (!id || !data.status || !Array.isArray(data.visitIDs)) {
      throw new Error("Timesheet ID, status, and visitIDs array are required.");
    }
    if (!["pending", "validated", "rejected", "visited"].includes(data.status)) {
      throw new Error("Status must be 'pending', 'validated', or 'rejected'.");
    }
    const response = await api.put<ValidateTimesheetResponse>(`/timesheets/${id}/validate`, { visitIDs: data.visitIDs, status: data.status });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to validate timesheet."));
  }
};

export const getTimesheetsBySupervisor = async (supervisorID: string): Promise<TimesheetsBySupervisorResponse> => {
  try {
    if (!supervisorID) {
      throw new Error("Supervisor ID is required.");
    }
    const response = await api.get<TimesheetsBySupervisorResponse>(`/timesheets/supervisor/${supervisorID}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to fetch timesheets for supervisor."));
  }
};

export const syncTimesheetToCalendar = async (timesheetId: string): Promise<SyncTimesheetCalendarResponse> => {
  try {
    if (!timesheetId) {
      throw new Error("Timesheet ID is required.");
    }
    const response = await api.post<SyncTimesheetCalendarResponse>(`/timesheets/${timesheetId}/sync-calendar`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to sync timesheet to calendar."));
  }
};

export const suggestTimesheet = async (data: {
  supervisorID: string;
  weekNumber: number;
  year: number;
  criteria: {
    delegationIds?: string[];
    agentIds?: string[];
    preferredDays?: string[];
    timeInterval?: { startHour: number; endHour: number };
    maxVisitsPerAgentPerWeek?: number;
    includeRecruitmentVisits?: boolean;
    recruitmentAreas?: string[];
    description?: string;
    filters?: Record<string, any>;
  };
  coordinates: { lat: number; lng: number };
}): Promise<{ suggestions: SuggestTimesheetResponse; requestId: string }> => {
  try {
    if (!data.supervisorID || !data.weekNumber || !data.year) {
      throw new Error("Supervisor ID, week number, and year are required.");
    }
    if (!data.coordinates || typeof data.coordinates.lat !== "number" || typeof data.coordinates.lng !== "number") {
      throw new Error("Valid coordinates (lat, lng) are required.");
    }
    if (data.criteria?.timeInterval) {
      const { startHour, endHour } = data.criteria.timeInterval;
      if (
        !Number.isInteger(startHour) ||
        !Number.isInteger(endHour) ||
        startHour < 0 ||
        endHour > 24 ||
        startHour >= endHour
      ) {
        throw new Error("Invalid time interval: startHour must be less than endHour and both must be integers between 0 and 24.");
      }
    }
    const response = await api.post<SuggestTimesheetApiResponse>("/timesheets/suggest", data);
    if (!response.data.suggestions || !Array.isArray(response.data.suggestions)) {
      throw new Error("Invalid suggestions response: Expected an array");
    }

    return {
      suggestions: response.data.suggestions,
      requestId: response.data.requestId,
    };
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to generate timesheet suggestions."));
  }
};

export const cancelTimesheetSuggestion = async (requestId: string): Promise<CancelTimesheetSuggestionResponse> => {
  try {
    if (!requestId) {
      throw new Error("Request ID is required.");
    }
    const response = await api.post<CancelTimesheetSuggestionResponse>(`/timesheets/suggest/cancel/${requestId}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to cancel timesheet suggestion."));
  }
};



export default {
  createTimesheet,
  updateTimesheet,
  deleteTimesheet,
  getAllTimesheets,
  getTimesheetById,
  getTimesheetByWeekNumberAndYear,
  validateTimesheet,
  getTimesheetsBySupervisor,
  syncTimesheetToCalendar,
  suggestTimesheet,
  cancelTimesheetSuggestion,
};