import api from "./axiosConfig";
import {
  CreateUserResponse,
  ListUsersResponse,
  UserByPhoneResponse,
  UserByIdResponse,
  UpdateUserResponse,
  DeleteUserResponse,
  SupervisorsByUserResponse,
  AssignDelegationsResponse,
  AssignDirectorResponse,
  AssignGovernoratesResponse,
  AssignRegionalManagerResponse,
  AssignRegionsResponse,
  AssignSupervisorToAgentResponse,
  RevokeDelegationsResponse,
  RevokeDirectorResponse,
  RevokeGovernoratesResponse,
  RevokeRegionalManagerResponse,
  RevokeRegionsResponse,
  RevokeSupervisorFromAgentResponse,
  AssignGoogleAccountResponse,
  DirectorByUserResponse,
  GetUsersByRoleResponse,
  RegionalManagersByUserResponse,
} from ".";
import User from "../models/User";
import Delegation from "../models/Delegation";
import Governorate from "../models/Governorate";
import Region from "../models/Region";

// --- Error Handling ---
interface AxiosErrorResponse {
  response?: {
    data?: {
      error?: string;
    };
    status?: number;
  };
}

interface RemovePFPRequest {
  removePFP: boolean;
}

const handleApiError = (error: unknown, defaultMessage: string): string => {
  if (error instanceof Error && "response" in error) {
    const axiosError = error as AxiosErrorResponse;
    if (axiosError.response?.data?.error) {
      return axiosError.response.data.error;
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
  }
  return defaultMessage;
};

// --- User Retrieval Functions ---
export const getAllUsers = async (): Promise<ListUsersResponse> => {
  try {
    const response = await api.get<ListUsersResponse>("/users");
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to fetch users."));
  }
};

export const getUserByPhone = async (phone: string): Promise<UserByPhoneResponse> => {
  try {
    if (!phone) {
      throw new Error("Phone number is required.");
    }
    const response = await api.get<UserByPhoneResponse>(`/users/phone/${phone}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "User not found."));
  }
};

export const getUserById = async (userID: string): Promise<UserByIdResponse> => {
  try {
    if (!userID) {
      throw new Error("User ID is required.");
    }
    const response = await api.get<UserByIdResponse>(`/users/${userID}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "User not found."));
  }
};

export const getUsersByRole = async (role: string): Promise<GetUsersByRoleResponse> => {
  try {
    if (!role) {
      throw new Error("Role is required.");
    }
    const response = await api.get<GetUsersByRoleResponse>(`/users/role/${role}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to fetch users by role."));
  }
};

export const fetchUserProfile = async (): Promise<User> => {
  try {
    const response = await api.get<User>("/users/profile");
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Failed to fetch profile."));
  }
};

export const getSupervisorsByUser = async (userID: string): Promise<SupervisorsByUserResponse> => {
  try {
    if (!userID) {
      throw new Error("User ID is required.");
    }
    const response = await api.get<SupervisorsByUserResponse>(`/users/${userID}/supervisors`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "No supervisors found."));
  }
};

export const getRegionalManagersByUser = async (userID: string): Promise<RegionalManagersByUserResponse> => {
  try {
    if (!userID) {
      throw new Error("User ID is required.");
    }
    const response = await api.get<RegionalManagersByUserResponse>(`/users/${userID}/regional-managers`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "No regional managers found."));
  }
};

export const getDirectorByUser = async (userID: string): Promise<DirectorByUserResponse> => {
  try {
    if (!userID) {
      throw new Error("User ID is required.");
    }
    const response = await api.get<DirectorByUserResponse>(`/users/${userID}/director`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "No director found."));
  }
};

// --- User Modification Functions ---
export const createUser = async (data: {
  email: string;
  password: string;
  firstname: string;
  lastname: string;
  phone: string;
}): Promise<CreateUserResponse> => {
  try {
    if (!data.email || !data.password || !data.firstname || !data.lastname || !data.phone) {
      throw new Error("All fields are required.");
    }
    const response = await api.post<CreateUserResponse>("/users", data);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to create user."));
  }
};

export const updateUser = async (
  userID: string,
  data: Partial<User>
): Promise<UpdateUserResponse> => {
  try {
    if (!userID) {
      throw new Error("User ID is required.");
    }
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (key === "PFP" && value instanceof File) {
        formData.append("PFP", value);
      } else if (value !== undefined) {
        formData.append(key, String(value));
      }
    });

    const response = await api.put<UpdateUserResponse>(`/users/${userID}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to update user."));
  }
};

export const updateProfile = async (
  data: Partial<User> | FormData | RemovePFPRequest
): Promise<User> => {
  try {
    const headers = data instanceof FormData ? { "Content-Type": "multipart/form-data" } : {};
    const response = await api.put<User>("/users/profile", data, { headers });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Failed to update profile."));
  }
};

export const deleteUser = async (userID: string): Promise<DeleteUserResponse> => {
  try {
    if (!userID) {
      throw new Error("User ID is required.");
    }
    const response = await api.delete<DeleteUserResponse>(`/users/${userID}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to delete user."));
  }
};

// --- Role Assignment Functions ---
export const assignRegionalManagerToSupervisor = async (
  supervisorID: string,
  regionalManagerID: string
): Promise<AssignRegionalManagerResponse> => {
  try {
    if (!supervisorID || !regionalManagerID) {
      throw new Error("Supervisor ID and Regional Manager ID are required.");
    }
    const response = await api.post<AssignRegionalManagerResponse>("/users/assign-regional-manager", {
      supervisorID,
      regionalManagerID,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to assign regional manager."));
  }
};

export const revokeRegionalManagerFromSupervisor = async (
  supervisorID: string,
  regionalManagerID: string
): Promise<RevokeRegionalManagerResponse> => {
  try {
    if (!supervisorID || !regionalManagerID) {
      throw new Error("Supervisor ID and Regional Manager ID are required.");
    }
    const response = await api.post<RevokeRegionalManagerResponse>("/users/revoke-regional-manager", {
      supervisorID,
      regionalManagerID,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to revoke regional manager."));
  }
};

export const assignDirectorToRegionalManager = async (
  regionalManagerID: string,
  directorID: string
): Promise<AssignDirectorResponse> => {
  try {
    if (!regionalManagerID || !directorID) {
      throw new Error("Regional Manager ID and Director ID are required.");
    }
    const response = await api.post<AssignDirectorResponse>("/users/assign-director", {
      regionalManagerID,
      directorID,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to assign director."));
  }
};

export const revokeDirectorFromRegionalManager = async (
  regionalManagerID: string
): Promise<RevokeDirectorResponse> => {
  try {
    if (!regionalManagerID) {
      throw new Error("Regional Manager ID is required.");
    }
    const response = await api.post<RevokeDirectorResponse>("/users/revoke-director", {
      regionalManagerID,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to revoke director."));
  }
};

export const assignSupervisorToAgent = async (
  agentID: string,
  supervisorID: string,
  delegationID: string
): Promise<AssignSupervisorToAgentResponse> => {
  try {
    if (!agentID || !supervisorID || !delegationID) {
      throw new Error("Agent ID, Supervisor ID, and Delegation ID are required.");
    }
    const response = await api.post<AssignSupervisorToAgentResponse>("/users/assign-supervisor-to-agent", {
      agentID,
      supervisorID,
      delegationID,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to assign supervisor to agent."));
  }
};

export const revokeSupervisorFromAgent = async (
  agentID: string
): Promise<RevokeSupervisorFromAgentResponse> => {
  try {
    if (!agentID) {
      throw new Error("Agent ID is required.");
    }
    const response = await api.post<RevokeSupervisorFromAgentResponse>(
      "/users/revoke-supervisor-from-agent",
      { agentID }
    );
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to revoke supervisor from agent."));
  }
};

// --- Location Assignment Functions ---
export const assignRegionsToRegionalManager = async (
  regionalManagerID: string,
  regionIDs: string[]
): Promise<AssignRegionsResponse> => {
  try {
    if (!regionalManagerID || !Array.isArray(regionIDs) || regionIDs.length === 0) {
      throw new Error("Regional Manager ID and Region IDs are required.");
    }
    const response = await api.post<AssignRegionsResponse>("/users/assign-regions", {
      regionalManagerID,
      regionIDs,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to assign regions."));
  }
};

export const revokeRegionsFromRegionalManager = async (
  regionalManagerID: string,
  regionIDs: string[]
): Promise<RevokeRegionsResponse> => {
  try {
    if (!regionalManagerID || !Array.isArray(regionIDs) || regionIDs.length === 0) {
      throw new Error("Regional Manager ID and Region IDs are required.");
    }
    const response = await api.post<RevokeRegionsResponse>("/users/revoke-regions", {
      regionalManagerID,
      regionIDs,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to revoke regions."));
  }
};

export const assignGovernoratesToSupervisor = async (
  supervisorID: string,
  governorateIDs: string[]
): Promise<AssignGovernoratesResponse> => {
  try {
    if (!supervisorID || !Array.isArray(governorateIDs) || governorateIDs.length === 0) {
      throw new Error("Supervisor ID and Governorate IDs are required.");
    }
    const response = await api.post<AssignGovernoratesResponse>("/users/assign-governorates", {
      supervisorID,
      governorateIDs,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to assign governorates."));
  }
};

export const revokeGovernoratesFromSupervisor = async (
  supervisorID: string,
  governorateIDs: string[]
): Promise<RevokeGovernoratesResponse> => {
  try {
    if (!supervisorID || !Array.isArray(governorateIDs) || governorateIDs.length === 0) {
      throw new Error("Supervisor ID and Governorate IDs are required.");
    }
    const response = await api.post<RevokeGovernoratesResponse>("/users/revoke-governorates", {
      supervisorID,
      governorateIDs,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to revoke governorates."));
  }
};

export const assignDelegationsToSupervisor = async (
  supervisorID: string,
  delegationIDs: string[]
): Promise<AssignDelegationsResponse> => {
  try {
    if (!supervisorID || !Array.isArray(delegationIDs) || delegationIDs.length === 0) {
      throw new Error("Supervisor ID and Delegation IDs are required.");
    }
    const response = await api.post<AssignDelegationsResponse>("/users/assign-delegations", {
      supervisorID,
      delegationIDs,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to assign delegations."));
  }
};

export const revokeDelegationsFromSupervisor = async (
  supervisorID: string,
  delegationIDs: string[]
): Promise<RevokeDelegationsResponse> => {
  try {
    if (!supervisorID || !Array.isArray(delegationIDs) || delegationIDs.length === 0) {
      throw new Error("Supervisor ID and Delegation IDs are required.");
    }
    const response = await api.post<RevokeDelegationsResponse>("/users/revoke-delegations", {
      supervisorID,
      delegationIDs,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to revoke delegations."));
  }
};

// --- Google Account Functions ---
export const assignGoogleAccount = async (
  userID: string,
  googleEmail: string
): Promise<AssignGoogleAccountResponse> => {
  try {
    if (!userID || !googleEmail) {
      throw new Error("User ID and Google email are required.");
    }
    const response = await api.post<AssignGoogleAccountResponse>(`/users/${userID}/google-account`, {
      googleEmail,
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Failed to assign Google account."));
  }
};

// --- Location Retrieval Functions ---
export const getAllRegions = async (): Promise<Region[]> => {
  try {
    const response = await api.get<Region[]>("/agents/regions");
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to fetch regions."));
  }
};

export const getAllGovernorates = async (): Promise<Governorate[]> => {
  try {
    const response = await api.get<Governorate[]>("/agents/governorates");
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to fetch governorates."));
  }
};

export const getAllDelegations = async (): Promise<Delegation[]> => {
  try {
    const response = await api.get<Delegation[]>("/agents/delegations");
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to fetch delegations."));
  }
};