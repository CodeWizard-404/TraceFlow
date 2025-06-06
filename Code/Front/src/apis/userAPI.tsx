import { AxiosError } from "axios";
import api from "./axiosConfig";
import User from "../models/User";
import { DeleteUserResponse, AssignRegionalManagerResponse, RevokeRegionalManagerResponse, AssignDirectorResponse, RevokeDirectorResponse, AssignRegionsResponse, RevokeRegionsResponse, AssignGovernoratesResponse, RevokeGovernoratesResponse, AssignDelegationsResponse, RevokeDelegationsResponse, AssignSupervisorToAgentResponse, RevokeSupervisorFromAgentResponse, GetUsersByRegionResponse, GetUsersByGovernorateResponse, GetUsersByDelegationResponse } from "./index";

// Generic error handler
const handleApiError = (error: unknown, defaultMessage: string): string => {
  const axiosError = error as AxiosError<{ error?: string }>;
  if (axiosError.response?.data?.error) {
    return axiosError.response.data.error;
  }
  switch (axiosError.response?.status) {
    case 400:
      return "Invalid request. Please check your input.";
    case 401:
      return "Please log in to continue.";
    case 403:
      return "Unauthorized.";
    case 404:
      return "Resource not found.";
    case 500:
      return "Server error. Please try again later.";
    default:
      return defaultMessage;
  }
};

// User Hierarchy Retrieval Functions
export const getSupervisorsByUser = async (userID: string): Promise<User[]> => {
  try {
    if (!userID) {
      throw new Error("User ID is required");
    }
    const response = await api.get<User[]>(`/users/${userID}/supervisors`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Supervisors not found"));
  }
};

export const getRegionalManagersByUser = async (userID: string): Promise<User[]> => {
  try {
    if (!userID) {
      throw new Error("User ID is required");
    }
    const response = await api.get<User[]>(`/users/${userID}/regional-managers`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Regional Managers not found"));
  }
};

export const getDirectorByUser = async (userID: string): Promise<User[]> => {
  try {
    if (!userID) {
      throw new Error("User ID is required");
    }
    const response = await api.get<User[]>(`/users/${userID}/director`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Director not found"));
  }
};





export const getUsersByRegion = async (regionID: string): Promise<GetUsersByRegionResponse> => {
  try {
    if (!regionID) {
      throw new Error("Region ID is required");
    }
    const response = await api.get<GetUsersByRegionResponse>(`/users/region/${regionID}/users`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Users not found"));
  }
};

export const getUsersByGovernorate = async (governorateID: string): Promise<GetUsersByGovernorateResponse> => {
  try {
    if (!governorateID) {
      throw new Error("Governorate ID is required");
    }
    const response = await api.get<GetUsersByGovernorateResponse>(`/users/governorate/${governorateID}/users`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Users not found"));
  }
};

export const getUsersByDelegation = async (delegationID: string): Promise<GetUsersByDelegationResponse> => {
  try {
    if (!delegationID) {
      throw new Error("Delegation ID is required");
    }
    const response = await api.get<GetUsersByDelegationResponse>(`/users/delegation/${delegationID}/users`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Users not found"));
  }
};







export const getSupervisorsByRegionalManager = async (regionalManagerID: string): Promise<User[]> => {
  try {
    if (!regionalManagerID) {
      throw new Error("Regional Manager ID is required");
    }
    const response = await api.get<User[]>(`/users/regional-manager/${regionalManagerID}/supervisors`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Supervisors not found"));
  }
};

export const getRegionalManagersByDirector = async (directorID: string): Promise<User[]> => {
  try {
    if (!directorID) {
      throw new Error("Director ID is required");
    }
    const response = await api.get<User[]>(`/users/director/${directorID}/regional-managers`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Regional Managers not found"));
  }
};

export const getDirectorByRegionalManager = async (regionalManagerID: string): Promise<User[]> => {
  try {
    if (!regionalManagerID) {
      throw new Error("Regional Manager ID is required");
    }
    const response = await api.get<User[]>(`/users/regional-manager/${regionalManagerID}/director`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Director not found"));
  }
};

export const getRegionalManagerBySupervisor = async (supervisorID: string): Promise<User[]> => {
  try {
    if (!supervisorID) {
      throw new Error("Supervisor ID is required");
    }
    const response = await api.get<User[]>(`/users/supervisor/${supervisorID}/regional-manager`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Regional Manager not found"));
  }
};











// Assignment and Revocation Functions for Regional Managers and Directors
export const assignRegionalManagerToSupervisor = async (
  supervisorID: string,
  regionalManagerID: string
): Promise<AssignRegionalManagerResponse> => {
  try {
    if (!supervisorID || !regionalManagerID) {
      throw new Error("Supervisor ID and Regional Manager ID are required");
    }
    const response = await api.post<AssignRegionalManagerResponse>("/users/assign-regional-manager", {
      supervisorID,
      regionalManagerID,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to assign regional manager"));
  }
};

export const revokeRegionalManagerFromSupervisor = async (
  supervisorID: string,
  confirmations: { revokeAll: boolean }
): Promise<RevokeRegionalManagerResponse> => {
  try {
    if (!supervisorID) {
      throw new Error("Supervisor ID is required");
    }
    const response = await api.post<RevokeRegionalManagerResponse>("/users/revoke-regional-manager", {
      supervisorID,
      confirmations,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to revoke regional manager"));
  }
};

export const assignDirectorToRegionalManager = async (
  regionalManagerID: string,
  directorID: string
): Promise<AssignDirectorResponse> => {
  try {
    if (!regionalManagerID || !directorID) {
      throw new Error("Regional Manager ID and Director ID are required");
    }
    const response = await api.post<AssignDirectorResponse>("/users/assign-director", {
      regionalManagerID,
      directorID,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to assign director"));
  }
};

export const revokeDirectorFromRegionalManager = async (
  regionalManagerID: string
): Promise<RevokeDirectorResponse> => {
  try {
    if (!regionalManagerID) {
      throw new Error("Regional Manager ID is required");
    }
    const response = await api.post<RevokeDirectorResponse>("/users/revoke-director", {
      regionalManagerID,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to revoke director"));
  }
};

export const assignSupervisorToAgent = async (
  agentID: string,
  supervisorID: string,
  delegationID: string
): Promise<AssignSupervisorToAgentResponse> => {
  try {
    if (!agentID || !supervisorID || !delegationID) {
      throw new Error("Agent ID, Supervisor ID, and Delegation ID are required");
    }
    const response = await api.post<AssignSupervisorToAgentResponse>("/users/assign-supervisor-to-agent", {
      agentID,
      supervisorID,
      delegationID,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to assign supervisor to agent"));
  }
};

export const revokeSupervisorFromAgent = async (
  agentID: string
): Promise<RevokeSupervisorFromAgentResponse> => {
  try {
    if (!agentID) {
      throw new Error("Agent ID is required");
    }
    const response = await api.post<RevokeSupervisorFromAgentResponse>("/users/revoke-supervisor-from-agent", {
      agentID,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to revoke supervisor from agent"));
  }
};







// Assignment and Revocation Functions for Regions, Governorates, and Delegations
export const assignRegionsToRegionalManager = async (
  regionalManagerID: string,
  regionIDs: string[]
): Promise<AssignRegionsResponse> => {
  try {
    if (!regionalManagerID || !Array.isArray(regionIDs) || regionIDs.length === 0) {
      throw new Error("Regional Manager ID and Region IDs are required");
    }
    const response = await api.post<AssignRegionsResponse>("/users/assign-regions", {
      regionalManagerID,
      regionIDs,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to assign regions"));
  }
};

export const revokeRegionsFromRegionalManager = async (
  regionalManagerID: string,
  regionIDs: string[],
  confirmations: { revokeSupervisors: boolean }
): Promise<RevokeRegionsResponse> => {
  try {
    if (!regionalManagerID || !Array.isArray(regionIDs) || regionIDs.length === 0) {
      throw new Error("Regional Manager ID and Region IDs are required");
    }
    const response = await api.post<RevokeRegionsResponse>("/users/revoke-regions", {
      regionalManagerID,
      regionIDs,
      confirmations,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to revoke regions"));
  }
};

export const assignGovernoratesToSupervisor = async (
  supervisorID: string,
  governorateIDs: string[]
): Promise<AssignGovernoratesResponse> => {
  try {
    if (!supervisorID || !Array.isArray(governorateIDs) || governorateIDs.length === 0) {
      throw new Error("Supervisor ID and Governorate IDs are required");
    }
    const response = await api.post<AssignGovernoratesResponse>("/users/assign-governorates", {
      supervisorID,
      governorateIDs,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to assign governorates"));
  }
};

export const revokeGovernoratesFromSupervisor = async (
  supervisorID: string,
  governorateIDs: string[],
  confirmations: { revokeAll: boolean }
): Promise<RevokeGovernoratesResponse> => {
  try {
    if (!supervisorID || !Array.isArray(governorateIDs) || governorateIDs.length === 0) {
      throw new Error("Supervisor ID and Governorate IDs are required");
    }
    const response = await api.post<RevokeGovernoratesResponse>("/users/revoke-governorates", {
      supervisorID,
      governorateIDs,
      confirmations,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to revoke governorates"));
  }
};

export const assignDelegationsToSupervisor = async (
  supervisorID: string,
  delegationIDs: string[]
): Promise<AssignDelegationsResponse> => {
  try {
    if (!supervisorID || !Array.isArray(delegationIDs) || delegationIDs.length === 0) {
      throw new Error("Supervisor ID and Delegation IDs are required");
    }
    const response = await api.post<AssignDelegationsResponse>("/users/assign-delegations", {
      supervisorID,
      delegationIDs,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to assign delegations"));
  }
};

export const revokeDelegationsFromSupervisor = async (
  supervisorID: string,
  delegationIDs: string[],
  confirmations: { revokeAgents: boolean }
): Promise<RevokeDelegationsResponse> => {
  try {
    if (!supervisorID || !Array.isArray(delegationIDs) || delegationIDs.length === 0) {
      throw new Error("Supervisor ID and Delegation IDs are required");
    }
    const response = await api.post<RevokeDelegationsResponse>("/users/revoke-delegations", {
      supervisorID,
      delegationIDs,
      confirmations,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to revoke delegations"));
  }
};








// Profile Management Functions
export const fetchUserProfile = async (): Promise<User> => {
  try {
    const response = await api.get<User>("/users/profile");
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Failed to fetch profile"));
  }
};

export interface UpdateProfileInput {
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  password?: string;
  PFP?: File | null;
  removePFP?: boolean;
}

export const updateProfile = async (data: Partial<User> & UpdateProfileInput): Promise<User> => {
  try {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (key === "PFP" && value instanceof File) {
        formData.append("PFP", value);
      } else if (key === "removePFP" && value === true) {
        formData.append("removePFP", "true");
      } else if (value !== undefined) {
        formData.append(key, String(value));
      }
    });

    const response = await api.put<User>("/users/profile", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Failed to update profile"));
  }
};











// User CRUD Functions
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const response = await api.get<User[]>("/users/");
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Failed to fetch users"));
  }
};

export const getUserByPhone = async (phone: string): Promise<User> => {
  try {
    if (!phone) {
      throw new Error("Phone number is required");
    }
    const response = await api.get<User>(`/users/phone/${phone}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "User not found"));
  }
};

export const getUserById = async (userID: string): Promise<User> => {
  try {
    if (!userID) {
      throw new Error("User ID is required");
    }
    const response = await api.get<User>(`/users/${userID}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "User not found"));
  }
};

export const getUsersByRole = async (role: string): Promise<User[]> => {
  try {
    if (!role) {
      throw new Error("Role is required");
    }
    const response = await api.get<User[]>(`/users/role/${role}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Failed to fetch users by role"));
  }
};

export const createUser = async (data: {
  email: string;
  password: string;
  firstname: string;
  lastname: string;
  phone: string;
}): Promise<User> => {
  try {
    if (!data.email || !data.password || !data.firstname || !data.lastname || !data.phone) {
      throw new Error("All fields are required");
    }
    const response = await api.post<User>("/users/", data);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to create user"));
  }
};

export const updateUser = async (
  userID: string,
  data: Partial<User>
): Promise<User> => {
  try {
    if (!userID) {
      throw new Error("User ID is required");
    }
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, String(value));
      }
    });

    const response = await api.put<User>(`/users/${userID}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to update user"));
  }
};

export const deleteUser = async (userID: string): Promise<DeleteUserResponse> => {
  try {
    if (!userID) {
      throw new Error("User ID is required");
    }
    const response = await api.delete<DeleteUserResponse>(`/users/${userID}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to delete user"));
  }
};


export default {
  getAllUsers,
  getUserByPhone,
  getUserById,
  getUsersByRole,
  createUser,
  updateUser,
  deleteUser,
  fetchUserProfile,
  updateProfile,
  getSupervisorsByUser,
  getRegionalManagersByUser,
  getDirectorByUser,
  getUsersByRegion,
  getUsersByDelegation,
  getRegionalManagerBySupervisor,
  getSupervisorsByRegionalManager,
};