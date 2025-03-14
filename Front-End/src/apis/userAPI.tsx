import axios from "axios";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";
import { CreateUserResponse, ListUsersResponse, UserByIdResponse, AssignRolesResponse, RolesByUserResponse } from ".";
import User from "../models/User";

const userApi = axios.create({
    baseURL: `${BASE_URL}/users`,
    timeout: DEFAULT_TIMEOUT,
});

export const createUser = async (userData: Partial<User>, token: string): Promise<CreateUserResponse> => {
    const response = await userApi.post<CreateUserResponse>("", userData, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const getAllUsers = async (token: string): Promise<ListUsersResponse> => {
    const response = await userApi.get<ListUsersResponse>("", {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const getUserById = async (userID: string, token: string): Promise<UserByIdResponse> => {
    const response = await userApi.get<UserByIdResponse>(`/${userID}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const assignRolesToUser = async (
    userID: string,
    roleIDs: string[],
    token: string
): Promise<AssignRolesResponse> => {
    const response = await userApi.post<AssignRolesResponse>(
        `/${userID}/roles`,
        { roleIDs },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};

export const getRolesByUser = async (userID: string, token: string): Promise<RolesByUserResponse> => {
    const response = await userApi.get<RolesByUserResponse>(`/${userID}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};