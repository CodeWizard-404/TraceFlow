import api from "./axiosConfig"; 
import { AgentsByLocationResponse, AgentLocationsResponse, AgentByPhoneResponse, AgentByIdResponse } from ".";

export const getAgentsByLocation = async (location: string, token: string): Promise<AgentsByLocationResponse> => {
  try {
    const response = await api.get<AgentsByLocationResponse>(`/agents/location?location=${location}`, {
      headers: { Authorization: `Bearer ${token}` },
  });
    return response.data;
  } catch (error) {
    console.error(`Error fetching agents by location (${location}):`, error);
    throw error;
  }
};

export const getAgentLocations = async (token: string): Promise<AgentLocationsResponse> => {
  try {
    const response = await api.get<AgentLocationsResponse>("/agents/locations", {
      headers: { Authorization: `Bearer ${token}` },
  });
    return response.data;
  } catch (error) {
    console.error("Error fetching agent locations:", error);
    throw error;
  }
};

export const getAgentByPhone = async (phone: string, token: string): Promise<AgentByPhoneResponse> => {
  try {
    const response = await api.get<AgentByPhoneResponse>(`/agents/phone/${phone}`, {
      headers: { Authorization: `Bearer ${token}` },
  });
    return response.data;
  } catch (error) {
    console.error(`Error fetching agent by phone (${phone}):`, error);
    throw error;
  }
};

export const getAgentById = async (id: string, token: string): Promise<AgentByIdResponse> => {
  try {
      const response = await api.get<AgentByIdResponse>(`/agents/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
  } catch (error) {
      console.error(`Error fetching agent by ID (${id}):`, error);
      throw error;
  }
};
