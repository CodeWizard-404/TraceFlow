import { AxiosError } from "axios";
import api from "./axiosConfig";
import {
    ListPermissionsResponse,
    PermissionByIdResponse,
    UpdatePermissionResponse,
    AssignPermissionsResponse,
    PermissionsByRoleResponse,
    EffectivePermissionsResponse,
    RevokePermissionsResponse,
    AxiosErrorResponse,
} from ".";

// Generic error handler
const handleApiError = (error: unknown, defaultMessage: string): string => {
    const axiosError = error as AxiosError<AxiosErrorResponse>;
    if (axiosError.response) {
        return axiosError.message;
    }
    switch (axiosError.status) {
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

// Get all permissions
export const getAllPermissions = async (): Promise<ListPermissionsResponse> => {
    try {
        const response = await api.get<ListPermissionsResponse>("/permissions");
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to fetch permissions."));
    }
};

// Get permission by ID
export const getPermissionById = async (permissionID: string): Promise<PermissionByIdResponse> => {
    try {
        if (!permissionID) {
            throw new Error("Permission ID is required.");
        }
        const response = await api.get<PermissionByIdResponse>(`/permissions/${permissionID}`);
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to fetch permission."));
    }
};

// Update a permission
export const updatePermission = async (
    permissionID: string,
    permissionData: { className?: string; description?: string }
): Promise<UpdatePermissionResponse> => {
    try {
        if (!permissionID) {
            throw new Error("Permission ID is required.");
        }
        const response = await api.put<UpdatePermissionResponse>(
            `/permissions/${permissionID}`,
            permissionData
        );
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to update permission."));
    }
};

// Assign permissions to a role
export const assignPermissionsToRole = async (
    roleID: string,
    permissionIDs: string[]
): Promise<AssignPermissionsResponse> => {
    try {
        if (!roleID || !Array.isArray(permissionIDs)) {
            throw new Error("Role ID and permission IDs are required.");
        }
        const response = await api.post<AssignPermissionsResponse>(
            `/permissions/role/${roleID}/assign`,
            { permissionIDs }
        );
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to assign permissions to role."));
    }
};

// Revoke permissions from a role
export const revokePermissionsFromRole = async (
    roleID: string,
    permissionIDs: string[]
): Promise<RevokePermissionsResponse> => {
    try {
        if (!roleID || !Array.isArray(permissionIDs)) {
            throw new Error("Role ID and permission IDs are required.");
        }
        const response = await api.post<RevokePermissionsResponse>(
            `/permissions/role/${roleID}/revoke`,
            { permissionIDs }
        );
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to revoke permissions from role."));
    }
};

// Get permissions by role
export const getPermissionsByRole = async (roleID: string): Promise<PermissionsByRoleResponse> => {
    try {
        if (!roleID) {
            throw new Error("Role ID is required.");
        }
        const response = await api.get<PermissionsByRoleResponse>(`/permissions/role/${roleID}`);
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to fetch permissions for role."));
    }
};


// Get effective permissions for a user
export const getEffectivePermissions = async (
    userID: string
): Promise<EffectivePermissionsResponse> => {
    try {
        if (!userID) {
            throw new Error("User ID is required.");
        }
        const response = await api.get<EffectivePermissionsResponse>(
            `/permissions/effective/${userID}`
        );
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to fetch effective permissions."));
    }
};

