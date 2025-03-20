import api from "./axiosConfig";
import {
  CreateUserResponse,
  ListUsersResponse,
  UserByIdResponse,
  AssignRolesResponse,
  RolesByUserResponse,
  GetSupervisorByPhoneNumberResponse,
  UpdateUserResponse,
  DeleteUserResponse,
  SupervisorsByUserResponse, 
  ManagersByUserResponse,    
  AssignSupervisorsResponse, 
} from ".";
import User from "../models/User";


export const getSupervisorByPhone = async (
  phone: string,
  token?: string
): Promise<GetSupervisorByPhoneNumberResponse> => {
  try {
    const response = await api.post<GetSupervisorByPhoneNumberResponse>(
      "/users/phone",
      { phone },
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    return response.data;
  } catch (error) {
    console.error(`Error fetching supervisor by phone (${phone}):`, error);
    throw error;
  }
};

export const createUser = async (
  userData: Partial<User>,
  token: string
): Promise<CreateUserResponse> => {
  try {
    const response = await api.post<CreateUserResponse>("/users", userData, {
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

export const assignRolesToUser = async (
  userID: string,
  roleIDs: string[],
  token: string
): Promise<AssignRolesResponse> => {
  try {
    const response = await api.post<AssignRolesResponse>(
      `/users/${userID}/roles`,
      { roleIDs },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    console.error(`Error assigning roles to user (${userID}):`, error);
    throw error;
  }
};

export const getRolesByUser = async (userID: string, token: string): Promise<RolesByUserResponse> => {
  try {
    const response = await api.get<RolesByUserResponse>(`/users/${userID}/roles`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching roles for user (${userID}):`, error);
    throw error;
  }
};

export const updateUser = async (
  userID: string,
  userData: Partial<User>,
  token: string
): Promise<UpdateUserResponse> => {
  try {
    const response = await api.put<UpdateUserResponse>(`/users/${userID}`, userData, {
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
    await api.delete(`/users/${userID}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch (error) {
    console.error(`Error deleting user (${userID}):`, error);
    throw error;
  }
};

export const getSupervisorsByUser = async (
  userID: string,
  token: string
): Promise<SupervisorsByUserResponse> => {
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

export const getManagersByUser = async (
  userID: string,
  token: string
): Promise<ManagersByUserResponse> => {
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

export const assignSupervisorsToManager = async (
  managerID: string,
  supervisorIDs: string[],
  token: string
): Promise<AssignSupervisorsResponse> => {
  try {
    const response = await api.post<AssignSupervisorsResponse>(
      "/users/assign-supervisors",
      { managerID, supervisorIDs },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    console.error(`Error assigning supervisors to manager (${managerID}):`, error);
    throw error;
  }
};