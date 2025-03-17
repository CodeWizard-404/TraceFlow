import axios from "axios";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";
import { AgentsByLocationResponse, AgentLocationsResponse, AgentByPhoneResponse, AgentByIdResponse } from ".";

const agentApi = axios.create({
  baseURL: `${BASE_URL}/agents`,
  timeout: DEFAULT_TIMEOUT,
});

export const getAgentsByLocation = async (location: string, token?: string): Promise<AgentsByLocationResponse> => {
  try {
    const response = await agentApi.get<AgentsByLocationResponse>(`/location?location=${location}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching agents by location (${location}):`, error);
    throw error;
  }
};

export const getAgentLocations = async (token?: string): Promise<AgentLocationsResponse> => {
  try {
    const response = await agentApi.get<AgentLocationsResponse>("/locations", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching agent locations:", error);
    throw error;
  }
};

export const getAgentByPhone = async (phone: string, token?: string): Promise<AgentByPhoneResponse> => {
  try {
    const response = await agentApi.get<AgentByPhoneResponse>(`/phone/${phone}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching agent by phone (${phone}):`, error);
    throw error;
  }
};

export const getAgentById = async (id: string, token?: string): Promise<AgentByIdResponse> => {
  try {
    const response = await agentApi.get<AgentByIdResponse>(`/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching agent by ID (${id}):`, error);
    throw error;
  }
};