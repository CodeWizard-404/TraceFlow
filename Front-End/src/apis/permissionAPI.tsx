import api from "./axiosConfig";
import {
    ListPermissionsResponse,
    PermissionByIdResponse,
    CreatePermissionResponse,
    UpdatePermissionResponse,
    DeletePermissionResponse,
    AssignPermissionsResponse,
    PermissionsByRoleResponse,
    AddPermissionOverrideResponse,
    RemovePermissionOverrideResponse,
    EffectivePermissionsResponse,
    UserPermissionOverrideResponse,
    RevokePermissionsResponse
} from ".";

export const getAllPermissions = async (token: string): Promise<ListPermissionsResponse> => {
    try {
        const response = await api.get<ListPermissionsResponse>("/permissions", {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching all permissions:", error);
        throw error;
    }
};

export const getPermissionById = async (permissionID: string, token: string): Promise<PermissionByIdResponse> => {
    try {
        const response = await api.get<PermissionByIdResponse>(`/permissions/${permissionID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching permission by ID (${permissionID}):`, error);
        throw error;
    }
};

export const createPermission = async (
    permissionData: { name: string; type: "page" | "feature"; className: string; description?: string },
    token: string
): Promise<CreatePermissionResponse> => {
    try {
        const response = await api.post<CreatePermissionResponse>("/permissions", permissionData, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error("Error creating permission:", error);
        throw error;
    }
};

export const updatePermission = async (
    permissionID: string,
    permissionData: { name?: string; type?: "page" | "feature"; className?: string; description?: string },
    token: string
): Promise<UpdatePermissionResponse> => {
    try {
        const response = await api.put<UpdatePermissionResponse>(`/permissions/${permissionID}`, permissionData, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error updating permission (${permissionID}):`, error);
        throw error;
    }
};

export const deletePermission = async (permissionID: string, token: string): Promise<DeletePermissionResponse> => {
    try {
        const response = await api.delete<DeletePermissionResponse>(`/permissions/${permissionID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error deleting permission (${permissionID}):`, error);
        throw error;
    }
};

export const assignPermissionsToRole = async (
    roleID: string,
    permissionIDs: string[],
    token: string
): Promise<AssignPermissionsResponse> => {
    try {
        const response = await api.post<AssignPermissionsResponse>(`/permissions/role/${roleID}/assign`, { permissionIDs }, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error assigning permissions to role (${roleID}):`, error);
        throw error;
    }
};

export const revokePermissionsFromRole = async (
    roleID: string,
    permissionIDs: string[],
    token: string
): Promise<RevokePermissionsResponse> => {
    try {
        const response = await api.post<RevokePermissionsResponse>(`/permissions/role/${roleID}/revoke`, { permissionIDs }, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error revoking permissions from role (${roleID}):`, error);
        throw error;
    }
};

export const getPermissionsByRole = async (roleID: string, token: string): Promise<PermissionsByRoleResponse> => {
    try {
        const response = await api.get<PermissionsByRoleResponse>(`/permissions/role/${roleID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching permissions for role (${roleID}):`, error);
        throw error;
    }
};

export const addPermissionOverride = async (
    userID: string,
    data: { roleID: string; permissionID: string; action: "grant" | "revoke" },
    token: string
): Promise<AddPermissionOverrideResponse> => {
    try {
        const response = await api.post<AddPermissionOverrideResponse>(`/permissions/override/${userID}`, data, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error adding permission override for user (${userID}):`, error);
        throw error;
    }
};

export const removePermissionOverride = async (
    overrideID: string,
    token: string
): Promise<RemovePermissionOverrideResponse> => {
    try {
        const response = await api.delete<RemovePermissionOverrideResponse>(`/permissions/override/${overrideID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error removing permission override (${overrideID}):`, error);
        throw error;
    }
};

export const getEffectivePermissions = async (userID: string, token: string): Promise<EffectivePermissionsResponse> => {
    try {
        const response = await api.get<EffectivePermissionsResponse>(`/permissions/effective/${userID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching effective permissions for user (${userID}):`, error);
        throw error;
    }
};

// Add this after getEffectivePermissions
export const getPermissionOverridesByUser = async (userID: string, token: string): Promise<UserPermissionOverrideResponse[]> => {
    try {
        const response = await api.get<UserPermissionOverrideResponse[]>(`/permissions/override/${userID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching permission overrides for user (${userID}):`, error);
        throw error;
    }
};