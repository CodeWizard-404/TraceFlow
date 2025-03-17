// src/apis/permissionAPI.tsx
import axios, { AxiosError } from "axios"; // Import AxiosError for proper typing
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";
import { ListPermissionsResponse, PermissionByIdResponse } from ".";

const permissionApi = axios.create({
    baseURL: `${BASE_URL}/permissions`,
    timeout: DEFAULT_TIMEOUT,
    withCredentials: true, 
});

interface ErrorResponse {
    error: string;
}

// Get all permissions
export const getAllPermissions = async (
    token: string,
    setError?: (error: string | null) => void
): Promise<ListPermissionsResponse> => {
    try {
        const response = await permissionApi.get<ListPermissionsResponse>("", {
            headers: { Authorization: `Bearer ${token}` },
        });
        setError?.(null); // Clear any previous error
        return response.data;
    } catch (error: unknown) { // Use unknown instead of any
        const axiosError = error as AxiosError<ErrorResponse>;
        const errorMessage = axiosError.response?.data?.error || "Failed to fetch all permissions";
        setError?.(errorMessage);
        throw axiosError; // Re-throw for component-level handling
    }
};

// Get permission by ID
export const getPermissionById = async (
    permissionID: string,
    token: string,
    setError?: (error: string | null) => void
): Promise<PermissionByIdResponse> => {
    try {
        const response = await permissionApi.get<PermissionByIdResponse>(`/${permissionID}`, {
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
        const response = await permissionApi.post<PermissionByIdResponse>("", permissionData, {
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
        const response = await permissionApi.put<PermissionByIdResponse>(`/${permissionID}`, permissionData, {
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
        await permissionApi.delete(`/${permissionID}`, {
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