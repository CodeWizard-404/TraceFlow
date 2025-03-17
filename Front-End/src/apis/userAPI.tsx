import axios from "axios";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";
import {
  CreateUserResponse,
  ListUsersResponse,
  UserByIdResponse,
  AssignRolesResponse,
  RolesByUserResponse,
  GetSupervisorByPhoneNumberResponse,
} from ".";
import User from "../models/User";

const userApi = axios.create({
  baseURL: `${BASE_URL}/users`,
  timeout: DEFAULT_TIMEOUT,
});

export const getSupervisorByPhone = async (
  phone: string,
  token?: string
): Promise<GetSupervisorByPhoneNumberResponse> => {
  try {
    const response = await userApi.post<GetSupervisorByPhoneNumberResponse>(
      "/phone",
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
    const response = await userApi.post<CreateUserResponse>("", userData, {
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
    const response = await userApi.get<ListUsersResponse>("", {
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
    const response = await userApi.get<UserByIdResponse>(`/${userID}`, {
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
    const response = await userApi.post<AssignRolesResponse>(
      `/${userID}/roles`,
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
    const response = await userApi.get<RolesByUserResponse>(`/${userID}/roles`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching roles for user (${userID}):`, error);
    throw error;
  }
};

export const updateUser = async (userID: string, userData: Partial<User>, token: string): Promise<User> => {
  try {
    const response = await userApi.put<User>(`/${userID}`, userData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error updating user (${userID}):`, error);
    throw error;
  }
};

export const deleteUser = async (userID: string, token: string): Promise<void> => {
  try {
    await userApi.delete(`/${userID}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch (error) {
    console.error(`Error deleting user (${userID}):`, error);
    throw error;
  }
};