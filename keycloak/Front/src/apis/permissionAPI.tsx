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

export const getAllPermissions = async (token: string): Promise<ListPermissionsResponse> => {
    try {
        const response = await api.get<ListPermissionsResponse>("/permissions", {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error: unknown) {
        const axiosError = error as AxiosError<AxiosErrorResponse>;
        throw new Error(axiosError.message);
    }
};

export const getPermissionById = async (
    permissionID: string,
    token: string
): Promise<PermissionByIdResponse> => {
    try {
        const response = await api.get<PermissionByIdResponse>(`/permissions/${permissionID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error: unknown) {
        const axiosError = error as AxiosError<AxiosErrorResponse>;
        throw new Error(axiosError.message);
    }
};

export const updatePermission = async (
    permissionID: string,
    permissionData: { className?: string; description?: string },
    token: string
): Promise<UpdatePermissionResponse> => {
    try {
        const response = await api.put<UpdatePermissionResponse>(
            `/permissions/${permissionID}`,
            permissionData,
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

export const assignPermissionsToRole = async (
    roleID: string,
    permissionIDs: string[],
    token: string
): Promise<AssignPermissionsResponse> => {
    try {
        const response = await api.post<AssignPermissionsResponse>(
            `/permissions/role/${roleID}/assign`,
            { permissionIDs },
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

export const revokePermissionsFromRole = async (
    roleID: string,
    permissionIDs: string[],
    token: string
): Promise<RevokePermissionsResponse> => {
    try {
        const response = await api.post<RevokePermissionsResponse>(
            `/permissions/role/${roleID}/revoke`,
            { permissionIDs },
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

export const getPermissionsByRole = async (
    roleID: string,
    token: string
): Promise<PermissionsByRoleResponse> => {
    try {
        const response = await api.get<PermissionsByRoleResponse>(
            `/permissions/role/${roleID}`,
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

export const addPermissionOverride = async (
    userID: string,
    data: { roleID: string; permissionID: string; action: "grant" | "revoke" },
    token: string
): Promise<AddPermissionOverrideResponse> => {
    try {
        const response = await api.post<AddPermissionOverrideResponse>(
            `/permissions/override/${userID}`,
            data,
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

export const removePermissionOverride = async (
    overrideID: string,
    token: string
): Promise<RemovePermissionOverrideResponse> => {
    try {
        const response = await api.delete<RemovePermissionOverrideResponse>(
            `/permissions/override/${overrideID}`,
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

export const getEffectivePermissions = async (
    userID: string,
    token: string
): Promise<EffectivePermissionsResponse> => {
    try {
        const response = await api.get<EffectivePermissionsResponse>(
            `/permissions/effective/${userID}`,
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

export const getPermissionOverridesByUser = async (
    userID: string,
    token: string
): Promise<UserPermissionOverrideResponse[]> => {
    try {
        const response = await api.get<UserPermissionOverrideResponse[]>(
            `/permissions/override/${userID}`,
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