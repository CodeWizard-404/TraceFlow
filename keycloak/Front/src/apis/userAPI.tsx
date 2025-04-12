import api from "./axiosConfig";
import {
  CreateUserResponse,
  ListUsersResponse,
  UserByPhoneResponse,
  UserByIdResponse,
  UpdateUserResponse,
  DeleteUserResponse,
  AssignSupervisorsResponse,
  RevokeSupervisorsResponse,
  SupervisorsByUserResponse,
  ManagersByUserResponse,
} from ".";
import User from "../models/User";

// Error response type for Axios errors
interface AxiosErrorResponse {
  response?: {
    data?: {
      error?: string;
    };
    status?: number;
  };
}

// Generic error handler
const handleApiError = (error: unknown, defaultMessage: string): string => {
  if (error instanceof Error && "response" in error) {
    const axiosError = error as AxiosErrorResponse;
    if (axiosError.response?.data?.error) {
      return axiosError.response.data.error; // Use backend's user-friendly error
    }
    if (axiosError.response?.status === 401) {
      return "Please log in to continue.";
    }
    if (axiosError.response?.status === 403) {
      return "You don’t have permission to perform this action.";
    }
    if (axiosError.response?.status === 500) {
      return "Something went wrong on our end. Please try again later.";
    }
  }
  return defaultMessage; // Fallback for network errors or unexpected issues
};

// Create a new user
export const createUser = async (
  data: { email: string; password: string; firstname: string; lastname: string; phone: string; wallet: string },
  token: string
): Promise<CreateUserResponse> => {
  try {
    const response = await api.post<CreateUserResponse>("/users", data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to create user. Please try again."));
  }
};

// Get all users
export const getAllUsers = async (token: string): Promise<ListUsersResponse> => {
  try {
    const response = await api.get<ListUsersResponse>("/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to fetch users. Please try again."));
  }
};

// Get user by phone number
export const getUserByPhone = async (phone: string, token: string): Promise<UserByPhoneResponse> => {
  try {
    const response = await api.get<UserByPhoneResponse>(`/users/phone/${phone}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "User not found."));
  }
};

// Get user by ID
export const getUserById = async (userID: string, token: string): Promise<UserByIdResponse> => {
  try {
    const response = await api.get<UserByIdResponse>(`/users/${userID}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "User not found."));
  }
};

// Fetch user profile
export const fetchUserProfile = async (token: string): Promise<User> => {
  try {
    const response = await api.get<User>("/users/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to fetch profile. Please try again."));
  }
};

// Update user details
export const updateUser = async (
  userID: string,
  data: Partial<User>,
  token: string
): Promise<UpdateUserResponse> => {
  try {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (key === "PFP" && value instanceof File) {
        formData.append("PFP", value);
      } else if (value !== undefined) {
        formData.append(key, String(value));
      }
    });

    const response = await api.put<UpdateUserResponse>(`/users/${userID}`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to update user. Please try again."));
  }
};

// Update user profile
export const updateProfile = async (data: Partial<User> | FormData, token: string): Promise<User> => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(data instanceof FormData ? { "Content-Type": "multipart/form-data" } : { "Content-Type": "application/json" }),
      },
    };
    const response = await api.put<User>("/users/profile", data, config);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to update profile. Please try again."));
  }
};

// Delete a user
export const deleteUser = async (userID: string, token: string): Promise<DeleteUserResponse> => {
  try {
    const response = await api.delete<DeleteUserResponse>(`/users/${userID}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to delete user. Please try again."));
  }
};

// Assign supervisors to a manager
export const assignSupervisorsToManager = async (
  managerID: string,
  supervisorIDs: string[],
  token: string
): Promise<AssignSupervisorsResponse> => {
  try {
    const response = await api.post<AssignSupervisorsResponse>("/users/assign-supervisors", { managerID, supervisorIDs }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to assign supervisors. Please try again."));
  }
};

// Revoke supervisors from a manager
export const revokeSupervisorsFromManager = async (
  managerID: string,
  supervisorIDs: string[],
  token: string
): Promise<RevokeSupervisorsResponse> => {
  try {
    const response = await api.post<RevokeSupervisorsResponse>("/users/revoke-supervisors", { managerID, supervisorIDs }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to revoke supervisors. Please try again."));
  }
};

// Get supervisors for a user
export const getSupervisorsByUser = async (userID: string, token: string): Promise<SupervisorsByUserResponse> => {
  try {
    const response = await api.get<SupervisorsByUserResponse>(`/users/${userID}/supervisors`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "No supervisors found."));
  }
};

// Get managers for a user
export const getManagersByUser = async (userID: string, token: string): Promise<ManagersByUserResponse> => {
  try {
    const response = await api.get<ManagersByUserResponse>(`/users/${userID}/managers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "No managers found."));
  }
};