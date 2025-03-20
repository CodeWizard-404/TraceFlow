// src/apis/permissionAPI.tsx
import { AxiosError } from "axios";
import api from "./axiosConfig";

import { ListPermissionsResponse, PermissionByIdResponse } from ".";


interface ErrorResponse {
    error: string;
}

// Get all permissions
export const getAllPermissions = async (
    token: string,
    setError?: (error: string | null) => void
): Promise<ListPermissionsResponse> => {
    try {
        const response = await api.get<ListPermissionsResponse>("/permissions", {
            headers: { Authorization: `Bearer ${token}` },
        });
        setError?.(null); 
        return response.data;
    } catch (error: unknown) { 
        const axiosError = error as AxiosError<ErrorResponse>;
        const errorMessage = axiosError.response?.data?.error || "Failed to fetch all permissions";
        setError?.(errorMessage);
        throw axiosError; 
    }
};

// Get permission by ID
export const getPermissionById = async (
    permissionID: string,
    token: string,
    setError?: (error: string | null) => void
): Promise<PermissionByIdResponse> => {
    try {
        const response = await api.get<PermissionByIdResponse>(`/permissions/${permissionID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        setError?.(null);
        return response.data;
    } catch (error: unknown) {
        const axiosError = error as AxiosError<ErrorResponse>;
        const errorMessage = axiosError.response?.data?.error || `Failed to fetch permission with ID ${permissionID}`;
        setError?.(errorMessage);
        throw axiosError;
    }
};

// Create a new permission
export const createPermission = async (
    permissionData: { name: string; type: "page" | "feature"; class: string; description?: string },
    token: string,
    setError?: (error: string | null) => void
): Promise<PermissionByIdResponse> => {
    try {
        const response = await api.post<PermissionByIdResponse>("/permissions", permissionData, {
            headers: { Authorization: `Bearer ${token}` },
        });
        setError?.(null);
        return response.data;
    } catch (error: unknown) {
        const axiosError = error as AxiosError<ErrorResponse>;
        const errorMessage = axiosError.response?.data?.error || "Failed to create permission";
        setError?.(errorMessage);
        throw axiosError;
    }
};

// Update an existing permission
export const updatePermission = async (
    permissionID: string,
    permissionData: Partial<{ name: string; type: "page" | "feature"; class: string; description?: string }>,
    token: string,
    setError?: (error: string | null) => void
): Promise<PermissionByIdResponse> => {
    try {
        const response = await api.put<PermissionByIdResponse>(`/permissions/${permissionID}`, permissionData, {
            headers: { Authorization: `Bearer ${token}` },
        });
        setError?.(null);
        return response.data;
    } catch (error: unknown) {
        const axiosError = error as AxiosError<ErrorResponse>;
        const errorMessage = axiosError.response?.data?.error || `Failed to update permission with ID ${permissionID}`;
        setError?.(errorMessage);
        throw axiosError;
    }
};

// Delete a permission
export const deletePermission = async (
    permissionID: string,
    token: string,
    setError?: (error: string | null) => void
): Promise<void> => {
    try {
        await api.delete(`/permissions/${permissionID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        setError?.(null);
    } catch (error: unknown) {
        const axiosError = error as AxiosError<ErrorResponse>;
        const errorMessage = axiosError.response?.data?.error || `Failed to delete permission with ID ${permissionID}`;
        setError?.(errorMessage);
        throw axiosError;
    }
};