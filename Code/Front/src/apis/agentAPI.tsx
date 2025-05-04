import { AxiosError } from "axios";
import api from "./axiosConfig";
import {
  AgentByIdResponse,
  AgentByPhoneResponse,
  AgentLocationsResponse,
  AgentsByDelegationResponse,
  AllAgentsResponse,
  CreateAgentResponse,
  UpdateAgentResponse,
  DeleteAgentResponse,
  SupervisorResponse,
  AxiosErrorResponse,
} from "./index";

// Generic error handler
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
      return "Resource not found.";
    case 500:
      return "Something went wrong on our end. Please try again later.";
    default:
      return defaultMessage;
  }
};

// Get agents by delegation
export const getAgentsByDelegation = async (delegationID: string): Promise<AgentsByDelegationResponse> => {
  try {
    if (!delegationID) {
      throw new Error("Delegation ID is required.");
    }
    const response = await api.get<AgentsByDelegationResponse>("/agents/delegation", {
      params: { delegationID },
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to fetch agents by delegation."));
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

// Get agent's supervisor
export const getAgentSupervisor = async (id: string): Promise<SupervisorResponse> => {
  try {
    if (!id) {
      throw new Error("Agent ID is required.");
    }
    const response = await api.get<SupervisorResponse>(`/agents/${id}/supervisor`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Supervisor not found."));
  }
};

// Get agents by user (supervisor)
export const getAgentsByUser = async (userID: string): Promise<AgentsByDelegationResponse> => {
  try {
    if (!userID) {
      throw new Error("User ID is required.");
    }
    const response = await api.get<AgentsByDelegationResponse>(`/agents/user/${userID}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to fetch agents by user."));
  }
};

// Create an agent
export const createAgent = async (agentData: {
  name: string;
  lastname: string;
  email: string;
  phone: string;
  supervisorID: string;
  delegationID: string;
}): Promise<CreateAgentResponse> => {
  try {
    if (!agentData.name || !agentData.lastname || !agentData.email || !agentData.phone || !agentData.supervisorID || !agentData.delegationID) {
      throw new Error("All fields are required.");
    }
    const response = await api.post<CreateAgentResponse>("/agents", agentData);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to create agent."));
  }
};

// Get all agents
export const getAllAgents = async (): Promise<AllAgentsResponse> => {
  try {
    const response = await api.get<AllAgentsResponse>("/agents");
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to fetch all agents."));
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

// Update an agent
export const updateAgent = async (
  id: string,
  agentData: Partial<{
    name: string;
    lastname: string;
    email: string;
    phone: string;
    supervisorID: string;
    delegationID: string;
  }>
): Promise<UpdateAgentResponse> => {
  try {
    if (!id) {
      throw new Error("Agent ID is required.");
    }
    const response = await api.put<UpdateAgentResponse>(`/agents/${id}`, agentData);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to update agent."));
  }
};

// Delete an agent
export const deleteAgent = async (id: string): Promise<DeleteAgentResponse> => {
  try {
    if (!id) {
      throw new Error("Agent ID is required.");
    }
    const response = await api.delete<DeleteAgentResponse>(`/agents/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to delete agent."));
  }
};