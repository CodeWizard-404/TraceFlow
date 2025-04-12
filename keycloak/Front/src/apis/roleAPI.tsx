import { AxiosError } from "axios";
import api from "./axiosConfig";
import {
    AssignRolesResponse,
    CreateRoleResponse,
    DeleteRoleResponse,
    ListRolesResponse,
    RevokeRoleResponse,
    RoleByIdResponse,
    RolesByUserResponse,
    UpdateRoleResponse,
    AxiosErrorResponse,
} from ".";

export const getAllRoles = async (token: string): Promise<ListRolesResponse> => {
    try {
        const response = await api.get<ListRolesResponse>("/roles", {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error: unknown) {
        const axiosError = error as AxiosError<AxiosErrorResponse>;
        throw new Error(axiosError.message);
    }
};

export const getRoleById = async (
    roleID: string,
    token: string
): Promise<RoleByIdResponse> => {
    try {
        const response = await api.get<RoleByIdResponse>(`/roles/${roleID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error: unknown) {
        const axiosError = error as AxiosError<AxiosErrorResponse>;
        throw new Error(axiosError.message);
    }
};

export const createRole = async (
    data: { name: string; description?: string },
    token: string
): Promise<CreateRoleResponse> => {
    try {
        const response = await api.post<CreateRoleResponse>("/roles", data, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error: unknown) {
        const axiosError = error as AxiosError<AxiosErrorResponse>;
        throw new Error(axiosError.message);
    }
};

export const updateRole = async (
    roleID: string,
    data: { name?: string; description?: string },
    token: string
): Promise<UpdateRoleResponse> => {
    try {
        const response = await api.put<UpdateRoleResponse>(`/roles/${roleID}`, data, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error: unknown) {
        const axiosError = error as AxiosError<AxiosErrorResponse>;
        throw new Error(axiosError.message);
    }
};

export const deleteRole = async (
    roleID: string,
    token: string
): Promise<DeleteRoleResponse> => {
    try {
        const response = await api.delete<DeleteRoleResponse>(`/roles/${roleID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error: unknown) {
        const axiosError = error as AxiosError<AxiosErrorResponse>;
        throw new Error(axiosError.message);
    }
};

export const assignRolesToUser = async (
    userID: string,
    roleIDs: string[],
    token: string
): Promise<AssignRolesResponse> => {
    try {
        const response = await api.post<AssignRolesResponse>(
            `/roles/user/${userID}/assign`,
            { roleIDs },
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );
        return response.data;
    } catch (error: unknown) {
        const axiosError = error as AxiosError<AxiosErrorResponse>;
        throw new Error(axiosError.message);
    }
};

export const revokeRolesFromUser = async (
    userID: string,
    roleIDs: string[],
    token: string
): Promise<RevokeRoleResponse | RevokeRoleResponse[]> => {
    try {
        const response = await api.post<RevokeRoleResponse | RevokeRoleResponse[]>(
            `/roles/user/${userID}/revoke`,
            { roleIDs },
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );
        return response.data;
    } catch (error: unknown) {
        const axiosError = error as AxiosError<AxiosErrorResponse>;
        throw new Error(axiosError.message);
    }
};

export const getRolesByUser = async (
    userID: string,
    token: string
): Promise<RolesByUserResponse> => {
    try {
        const response = await api.get<RolesByUserResponse>(
            `/roles/user/${userID}`,
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );
        return response.data;
    } catch (error: unknown) {
        const axiosError = error as AxiosError<AxiosErrorResponse>;
        throw new Error(axiosError.message);
    }
};

export const resetMainRoles = async (
    token: string
): Promise<{ message: string; details: unknown }> => {
    try {
        const response = await api.post<{ message: string; details: unknown }>(
            "/roles/reset",
            {},
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );
        return response.data;
    } catch (error: unknown) {
        const axiosError = error as AxiosError<AxiosErrorResponse>;
        throw new Error(axiosError.message);
    }
};