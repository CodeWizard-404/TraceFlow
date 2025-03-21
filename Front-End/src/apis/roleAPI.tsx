import api from "./axiosConfig";
import {
    CreateRoleResponse,
    ListRolesResponse,
    RoleByIdResponse,
    UpdateRoleResponse,
    DeleteRoleResponse,
    AssignRolesResponse,
    RolesByUserResponse,
} from ".";

export const createRole = async (
    data: { name: string; description?: string },
    token: string
): Promise<CreateRoleResponse> => {
    try {
        const response = await api.post<CreateRoleResponse>("/roles", data, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error("Error creating role:", error);
        throw error;
    }
};

export const getAllRoles = async (token: string): Promise<ListRolesResponse> => {
    try {
        const response = await api.get<ListRolesResponse>("/roles", {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching all roles:", error);
        throw error;
    }
};

export const getRoleById = async (roleID: string, token: string): Promise<RoleByIdResponse> => {
    try {
        const response = await api.get<RoleByIdResponse>(`/roles/${roleID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching role by ID (${roleID}):`, error);
        throw error;
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
    } catch (error) {
        console.error(`Error updating role (${roleID}):`, error);
        throw error;
    }
};

export const deleteRole = async (roleID: string, token: string): Promise<DeleteRoleResponse> => {
    try {
        const response = await api.delete<DeleteRoleResponse>(`/roles/${roleID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error deleting role (${roleID}):`, error);
        throw error;
    }
};

export const assignRolesToUser = async (
    userID: string,
    roleIDs: string[],
    token: string
): Promise<AssignRolesResponse> => {
    try {
        const response = await api.post<AssignRolesResponse>(`/roles/user/${userID}/assign`, { roleIDs }, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error assigning roles to user (${userID}):`, error);
        throw error;
    }
};

export const getRolesByUser = async (userID: string, token: string): Promise<RolesByUserResponse> => {
    try {
        const response = await api.get<RolesByUserResponse>(`/roles/user/${userID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching roles for user (${userID}):`, error);
        throw error;
    }
};