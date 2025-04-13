import { AxiosError } from "axios";
import api from "./axiosConfig";
import {
    ListPermissionsResponse,
    PermissionByIdResponse,
    UpdatePermissionResponse,
    AssignPermissionsResponse,
    PermissionsByRoleResponse,
    AddPermissionOverrideResponse,
    RemovePermissionOverrideResponse,
    EffectivePermissionsResponse,
    UserPermissionOverrideResponse,
    RevokePermissionsResponse,
    AxiosErrorResponse,
} from ".";

// Generic error handler
const handleApiError = (error: unknown, defaultMessage: string): string => {
    const axiosError = error as AxiosError<AxiosErrorResponse>;
    if (axiosError.response?.data) {
        return axiosError.message; // Use backend's user-friendly error
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

// Add permission override for a user
export const addPermissionOverride = async (
    userID: string,
    data: { roleID: string; permissionID: string; action: "grant" | "revoke" }
): Promise<AddPermissionOverrideResponse> => {
    try {
        if (!userID || !data.roleID || !data.permissionID || !["grant", "revoke"].includes(data.action)) {
            throw new Error("User ID, role ID, permission ID, and action are required.");
        }
        const response = await api.post<AddPermissionOverrideResponse>(
            `/permissions/override/${userID}`,
            data
        );
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to add permission override."));
    }
};

// Remove permission override
export const removePermissionOverride = async (
    overrideID: string
): Promise<RemovePermissionOverrideResponse> => {
    try {
        if (!overrideID) {
            throw new Error("Override ID is required.");
        }
        const response = await api.delete<RemovePermissionOverrideResponse>(
            `/permissions/override/${overrideID}`
        );
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to remove permission override."));
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

// Get permission overrides for a user
export const getPermissionOverridesByUser = async (
    userID: string
): Promise<UserPermissionOverrideResponse[]> => {
    try {
        if (!userID) {
            throw new Error("User ID is required.");
        }
        const response = await api.get<UserPermissionOverrideResponse[]>(
            `/permissions/override/${userID}`
        );
        return response.data;
    } catch (error: unknown) {
        throw new Error(handleApiError(error, "Unable to fetch permission overrides."));
    }
};