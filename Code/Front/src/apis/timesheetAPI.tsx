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
  TimesheetByWeekNumberAndYearResponse
} from ".";

// Type for timesheet calendar sync response
export type SyncTimesheetCalendarResponse = Array<{
  visitId: string;
  calendarEventId: string;
  status: "created" | "updated";
}>;

// Type for timesheet suggestions response (matches parent component expectations)
export type SuggestTimesheetResponse = Array<{
  agentID: string | null;
  supervisorID: string;
  schedule: Array<{
    date: string; // DD/MM/YYYY
    visits: Array<{
      startTime: string; // HH:MM
      location: string;
      latitude: number | null;
      longitude: number | null;
      reasons: Array<{ id: string; item: string }>;
      checklists: Array<{ id: string; item: string }>;
    }>;
  }>;
}>;

// Type for the raw API response
type SuggestTimesheetApiResponse = {
  suggestions: Array<{
    agentID: string | null;
    supervisorID: string;
    schedule: Array<{
      date: string; // YYYY-MM-DD
      visits: Array<{
        time: string; // HH:MM
        location: string;
        latitude: number | null;
        longitude: number | null;
        reasons: Array<{ id: string }>;
        checklists: Array<{ id: string }>;
      }>;
    }>;
  }>;
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
      return "Timesheet or request not found.";
    case 499:
      return "Request was canceled.";
    case 500:
      return "Something went wrong on our end. Please try again later.";
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
    reasons: Array<{ text?: string; id?: string }>;
    checklists: Array<{ text?: string; id?: string }>;
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
    const axiosError = error as AxiosErrorResponse;
    let errorMessage = handleApiError(error, "Unable to create timesheet.");
    if (axiosError.response?.data?.error?.includes("Failed to sync")) {
      console.warn("Timesheet created but Google Calendar sync failed:", axiosError.response);
      errorMessage = "Timesheet created, but Google Calendar sync failed. Please try syncing again later.";
    }
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
): Promise<TimesheetByWeekNumberAndYearResponse> => {
  try {
    if (!weekNumber || !year || !supervisorID) {
      throw new Error("Week number, year, and supervisor ID are required.");
    }
    const response = await api.get<TimesheetByWeekNumberAndYearResponse>(
      `/timesheets/week/${weekNumber}/year/${year}/supervisor/${supervisorID}`
    );
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to fetch timesheet by week number and year."));
  }
};

export const validateTimesheet = async (
  id: string,
  data: { visitIDs: string[]; status: string }
): Promise<ValidateTimesheetResponse> => {
  try {
    if (!id || !data.status) {
      throw new Error("Timesheet ID and status are required.");
    }
    const response = await api.put<ValidateTimesheetResponse>(`/timesheets/${id}/validate`, data);
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
  supervisorId: string;
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
    if (!data.supervisorId || !data.weekNumber || !data.year) {
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
    if (data.criteria?.includeRecruitmentVisits && (!data.criteria.recruitmentAreas || data.criteria.recruitmentAreas.length === 0)) {
      throw new Error("Recruitment areas are required when includeRecruitmentVisits is true.");
    }
    const response = await api.post<SuggestTimesheetApiResponse>("/timesheets/suggest", data);
    console.log("Raw API response:", JSON.stringify(response.data, null, 2));
    if (!response.data.suggestions || !Array.isArray(response.data.suggestions)) {
      console.error("Invalid suggestions response: Expected an array", response.data);
      throw new Error("Invalid suggestions response: Expected an array");
    }

    // Transform the response to match parent component expectations
    const transformedSuggestions: SuggestTimesheetResponse = response.data.suggestions.map(suggestion => ({
      ...suggestion,
      schedule: suggestion.schedule.map(day => {
        // Convert date from YYYY-MM-DD to DD/MM/YYYY
        const [y, m, d] = day.date.split("-").map(Number);
        const formattedDate = `${d.toString().padStart(2, "0")}/${m.toString().padStart(2, "0")}/${y}`;
        return {
          date: formattedDate,
          visits: day.visits.map(visit => ({
            ...visit,
            startTime: visit.time, // Rename time to startTime
            reasons: visit.reasons.map(reason => ({
              id: reason.id,
              item: `Reason ${reason.id}` // Mock item field
            })),
            checklists: visit.checklists.map(checklist => ({
              id: checklist.id,
              item: `Checklist ${checklist.id}` // Mock item field
            }))
          }))
        };
      })
    }));

    console.log("Transformed suggestions:", JSON.stringify(transformedSuggestions, null, 2));
    return {
      suggestions: transformedSuggestions,
      requestId: response.data.requestId,
    };
  } catch (error) {
    console.error("Error in suggestTimesheet:", error);
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