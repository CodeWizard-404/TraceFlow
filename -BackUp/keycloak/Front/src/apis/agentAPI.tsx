import { AxiosError } from "axios";
import api from "./axiosConfig";
import { AgentsByLocationResponse, AgentLocationsResponse, AgentByPhoneResponse, AgentByIdResponse } from ".";

// Error response type for Axios errors
interface AxiosErrorResponse {
  response?: {
    data?: { error?: string };
    status?: number;
  };
}

// Generic error handler
const handleApiError = (error: unknown, defaultMessage: string): string => {
  const axiosError = error as AxiosError<AxiosErrorResponse>;
  if (axiosError.response?.data) {
    return axiosError.message; // Use backend's user-friendly error
  }
  switch (axiosError.response?.status) {
    case 400:
      return "Invalid request. Please check your input and try again.";
    case 401:
      return "Authentication failed. Please log in again.";
    case 403:
      return "You don’t have permission to perform this action.";
    case 404:
      return "Resource not found.";
    case 500:
      return "Something went wrong on our end. Please try again later.";
    default:
      return defaultMessage;
  }
};

// Get agents by location
export const getAgentsByLocation = async (location: string): Promise<AgentsByLocationResponse> => {
  try {
    if (!location) {
      throw new Error("Location is required.");
    }
    const response = await api.get<AgentsByLocationResponse>(`/agents/location?location=${location}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to fetch agents by location."));
  }
};

// Get all unique agent locations
export const getAgentLocations = async (): Promise<AgentLocationsResponse> => {
  try {
    const response = await api.get<AgentLocationsResponse>("/agents/locations");
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to fetch agent locations."));
  }
};

// Get agent by phone number
export const getAgentByPhone = async (phone: string): Promise<AgentByPhoneResponse> => {
  try {
    if (!phone) {
      throw new Error("Phone number is required.");
    }
    const response = await api.get<AgentByPhoneResponse>(`/agents/phone/${phone}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Agent not found."));
  }
};

// Get agent by ID
export const getAgentById = async (id: string): Promise<AgentByIdResponse> => {
  try {
    if (!id) {
      throw new Error("Agent ID is required.");
    }
    const response = await api.get<AgentByIdResponse>(`/agents/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Agent not found."));
  }
};