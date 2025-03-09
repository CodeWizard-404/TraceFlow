import axios from "axios";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";
import { AgentsByLocationResponse, AgentLocationsResponse, AgentByPhoneResponse, AgentByIdResponse } from ".";

const agentApi = axios.create({
  baseURL: `${BASE_URL}/agents`,
  timeout: DEFAULT_TIMEOUT,
});

export const getAgentsByLocation = async (location: string): Promise<AgentsByLocationResponse> => {
  const response = await agentApi.get<AgentsByLocationResponse>(`/location?location=${location}`);
  return response.data;
};

export const getAgentLocations = async (): Promise<AgentLocationsResponse> => {
  const response = await agentApi.get<AgentLocationsResponse>("/locations");
  return response.data;
};

export const getAgentByPhone = async (phone: string): Promise<AgentByPhoneResponse> => {
  const response = await agentApi.get<AgentByPhoneResponse>(`/phone/${phone}`);
  return response.data;
};

export const getAgentById = async (id: string): Promise<AgentByIdResponse> => {
  const response = await agentApi.get<AgentByIdResponse>(`/${id}`);
  return response.data;
};