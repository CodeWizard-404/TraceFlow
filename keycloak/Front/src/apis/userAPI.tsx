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
interface RemovePFPRequest {
  removePFP: boolean;
}

// Generic error handler
const handleApiError = (error: unknown, defaultMessage: string): string => {
  if (error instanceof Error && "response" in error) {
    const axiosError = error as AxiosErrorResponse;
    if (axiosError.response?.data?.error) {
      return axiosError.response.data.error; // Use backend's user-friendly error
    }
    switch (axiosError.response?.status) {
      case 400:
        return "Invalid request. Please check your input and try again.";
      case 401:
        return "Authentication failed. Please log in again.";
      case 403:
        return "You don’t have permission to perform this action.";
      case 404:
        return "User not found.";
      case 500:
        return "Something went wrong on our end. Please try again later.";
      default:
        return defaultMessage;
    }
  }
  return defaultMessage; // Fallback for network errors or unexpected issues
};


export interface AssignGoogleAccountResponse {
  user: User;
  message: string;
}

export const assignGoogleAccount = async (
  userID: string,
  googleEmail: string
): Promise<AssignGoogleAccountResponse> => {
  try {
    const response = await api.post(`/users/${userID}/google-account`, { googleEmail });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosErrorResponse;
    let errorMessage = 'Failed to assign Google account.';
    if (axiosError.response?.data?.error) {
      errorMessage = axiosError.response.data.error;
    } else {
      switch (axiosError.response?.status) {
        case 400:
          errorMessage = 'Invalid request. Please check the Google email.';
          break;
        case 401:
          errorMessage = 'Unauthorized action.';
          break;
        case 403:
          errorMessage = 'Access denied.';
          break;
        case 404:
          errorMessage = 'User not found.';
          break;
        case 409:
          errorMessage = 'Google email already linked to another user.';
          break;
        case 500:
          errorMessage = 'Server error. Please try again.';
          break;
        default:
          errorMessage = 'Failed to assign Google account.';
      }
    }
    throw new Error(errorMessage);
  }
};


// Create a new user
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
    throw new Error(handleApiError(error, "Unable to create user. Please try again."));
  }
};

// Get all users
export const getAllUsers = async (): Promise<ListUsersResponse> => {
  try {
    const response = await api.get<ListUsersResponse>("/users");
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to fetch users. Please try again."));
  }
};

// Get user by phone number
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

// Get user by ID
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

// Fetch user profile
export const fetchUserProfile = async (): Promise<User> => {
  try {
    const response = await api.get<User>("/users/profile");
    return response.data;
  } catch (error) {
    console.error("Error fetching profile:", error);
    throw error instanceof Error ? error : new Error("Failed to fetch profile");
  }
};

// Update user details
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
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to update user. Please try again."));
  }
};

// Update the parameter type to include RemovePFPRequest
export const updateProfile = async (
  data: Partial<User> | FormData | RemovePFPRequest
): Promise<User> => {
  try {
    const headers = data instanceof FormData ? { "Content-Type": "multipart/form-data" } : {};
    const response = await api.put<User>("/users/profile", data, { headers });
    return response.data;
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error instanceof Error ? error : new Error("Failed to update profile");
  }
};

// Delete a user
export const deleteUser = async (userID: string): Promise<DeleteUserResponse> => {
  try {
    if (!userID) {
      throw new Error("User ID is required.");
    }
    const response = await api.delete<DeleteUserResponse>(`/users/${userID}`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to delete user. Please try again."));
  }
};

// Assign supervisors to a manager
export const assignSupervisorsToManager = async (
  managerID: string,
  supervisorIDs: string[]
): Promise<AssignSupervisorsResponse> => {
  try {
    if (!managerID || !Array.isArray(supervisorIDs) || supervisorIDs.length === 0) {
      throw new Error("Manager ID and supervisor IDs are required.");
    }
    const response = await api.post<AssignSupervisorsResponse>("/users/assign-supervisors", { managerID, supervisorIDs });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to assign supervisors. Please try again."));
  }
};

// Revoke supervisors from a manager
export const revokeSupervisorsFromManager = async (
  managerID: string,
  supervisorIDs: string[]
): Promise<RevokeSupervisorsResponse> => {
  try {
    if (!managerID || !Array.isArray(supervisorIDs) || supervisorIDs.length === 0) {
      throw new Error("Manager ID and supervisor IDs are required.");
    }
    const response = await api.post<RevokeSupervisorsResponse>("/users/revoke-supervisors", { managerID, supervisorIDs });
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "Unable to revoke supervisors. Please try again."));
  }
};

// Get supervisors for a user
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

// Get managers for a user
export const getManagersByUser = async (userID: string): Promise<ManagersByUserResponse> => {
  try {
    if (!userID) {
      throw new Error("User ID is required.");
    }
    const response = await api.get<ManagersByUserResponse>(`/users/${userID}/managers`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error, "No managers found."));
  }
};