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

// Generic error handler
const handleApiError = (error: unknown, defaultMessage: string): string => {
    const axiosError = error as AxiosError<AxiosErrorResponse>;
    if (axiosError.response?.data) {
        return axiosError.message || defaultMessage;
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
};
// Get all roles
export const getAllRoles = async (): Promise<ListRolesResponse> => {
    try {
        const response = await api.get<ListRolesResponse>("/roles");
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to fetch roles."));
    }
};

// Get role by ID
export const getRoleById = async (roleID: string): Promise<RoleByIdResponse> => {
    try {
        if (!roleID) {
            throw new Error("Role ID is required.");
        }
        const response = await api.get<RoleByIdResponse>(`/roles/${roleID}`);
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to fetch role."));
    }
};

// Create a new role
export const createRole = async (data: {
    name: string;
    description?: string;
}): Promise<CreateRoleResponse> => {
    try {
        if (!data.name) {
            throw new Error("Role name is required.");
        }
        const response = await api.post<CreateRoleResponse>("/roles", data);
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to create role."));
    }
};

// Update a role
export const updateRole = async (
    roleID: string,
    data: { name?: string; description?: string }
): Promise<UpdateRoleResponse> => {
    try {
        if (!roleID) {
            throw new Error("Role ID is required.");
        }
        const response = await api.put<UpdateRoleResponse>(`/roles/${roleID}`, data);
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to update role."));
    }
};

// Delete a role
export const deleteRole = async (roleID: string): Promise<DeleteRoleResponse> => {
    try {
        if (!roleID) {
            throw new Error("Role ID is required.");
        }
        const response = await api.delete<DeleteRoleResponse>(`/roles/${roleID}`);
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to delete role."));
    }
};

// Assign roles to a user
export const assignRolesToUser = async (
    userID: string,
    roleIDs: string[]
): Promise<AssignRolesResponse> => {
    try {
        if (!userID || !Array.isArray(roleIDs)) {
            throw new Error("User ID and role IDs are required.");
        }
        const response = await api.post<AssignRolesResponse>(
            `/roles/user/${userID}/assign`,
            { roleIDs }
        );
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to assign roles."));
    }
};

// Revoke roles from a user
export const revokeRolesFromUser = async (
    userID: string,
    roleIDs: string[]
): Promise<RevokeRoleResponse> => {
    try {
        if (!userID || !Array.isArray(roleIDs) || roleIDs.length === 0) {
            throw new Error("User ID and role IDs are required.");
        }
        const response = await api.post<RevokeRoleResponse>(
            `/roles/user/${userID}/revoke`,
            { roleIDs }
        );
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to revoke roles."));
    }
};

// Get roles for a user
export const getRolesByUser = async (
    userID: string
): Promise<RolesByUserResponse> => {
    try {
        if (!userID) {
            throw new Error("User ID is required.");
        }
        const response = await api.get<RolesByUserResponse>(`/roles/user/${userID}`);
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to fetch user roles."));
    }
};

// Reset main roles
export const resetMainRoles = async (): Promise<{ message: string; details: unknown }> => {
    try {
        const response = await api.post<{ message: string; details: unknown }>("/roles/reset", {});
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to reset main roles."));
    }
};