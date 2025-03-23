import api from "./axiosConfig";
import {
  CreateUserResponse,
  ListUsersResponse,
  UserByPhoneResponse,
  UserByIdResponse,
  UpdateUserResponse,
  DeleteUserResponse,
  AssignSupervisorsResponse,
  SupervisorsByUserResponse,
  ManagersByUserResponse,
  RevokeSupervisorsResponse
} from ".";
import User from "../models/User";

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
    console.error("Error creating user:", error);
    throw error;
  }
};

export const getAllUsers = async (token: string): Promise<ListUsersResponse> => {
  try {
    const response = await api.get<ListUsersResponse>("/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching all users:", error);
    throw error;
  }
};

export const getUserByPhone = async (phone: string, token: string) => {
  try {
    const response = await api.get<UserByPhoneResponse>(`/users/phone/${phone}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
    );
    return response.data;
  } catch (error) {
    console.error(`Error fetching user by phone (${phone}):`, error);
    throw error;
  }
};

export const getUserById = async (userID: string, token: string): Promise<UserByIdResponse> => {
  try {
    const response = await api.get<UserByIdResponse>(`/users/${userID}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching user by ID (${userID}):`, error);
    throw error;
  }
};

export const updateUser = async (
  userID: string,
  data: Partial<User>,
  token: string
): Promise<UpdateUserResponse> => {
  try {
    const response = await api.put<UpdateUserResponse>(`/users/${userID}`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error updating user (${userID}):`, error);
    throw error;
  }
};

export const deleteUser = async (userID: string, token: string): Promise<DeleteUserResponse> => {
  try {
    const response = await api.delete<DeleteUserResponse>(`/users/${userID}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error deleting user (${userID}):`, error);
    throw error;
  }
};

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
    console.error(`Error assigning supervisors to manager (${managerID}):`, error);
    throw error;
  }
};

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
    console.error(`Error revoking supervisors from manager (${managerID}):`, error);
    throw error;
  }
};


export const getSupervisorsByUser = async (userID: string, token: string): Promise<SupervisorsByUserResponse> => {
  try {
    const response = await api.get<SupervisorsByUserResponse>(`/users/${userID}/supervisors`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching supervisors for user (${userID}):`, error);
    throw error;
  }
};

export const getManagersByUser = async (userID: string, token: string): Promise<ManagersByUserResponse> => {
  try {
    const response = await api.get<ManagersByUserResponse>(`/users/${userID}/managers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching managers for user (${userID}):`, error);
    throw error;
  }
};