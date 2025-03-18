import api from "./axiosConfig"; // Use the shared instance
import { AgentsByLocationResponse, AgentLocationsResponse, AgentByPhoneResponse, AgentByIdResponse } from ".";

export const getAgentsByLocation = async (location: string): Promise<AgentsByLocationResponse> => {
  try {
    const response = await api.get<AgentsByLocationResponse>(`/agents/location?location=${location}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching agents by location (${location}):`, error);
    throw error;
  }
};

export const getAgentLocations = async (): Promise<AgentLocationsResponse> => {
  try {
    const response = await api.get<AgentLocationsResponse>("/agents/locations");
    return response.data;
  } catch (error) {
    console.error("Error fetching agent locations:", error);
    throw error;
  }
};

export const getAgentByPhone = async (phone: string): Promise<AgentByPhoneResponse> => {
  try {
    const response = await api.get<AgentByPhoneResponse>(`/agents/phone/${phone}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching agent by phone (${phone}):`, error);
    throw error;
  }
};

export const getAgentById = async (id: string): Promise<AgentByIdResponse> => {
  try {
    const response = await api.get<AgentByIdResponse>(`/agents/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching agent by ID (${id}):`, error);
    throw error;
  }
};