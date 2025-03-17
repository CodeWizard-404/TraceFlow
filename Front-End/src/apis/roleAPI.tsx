import axios from "axios";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";
import { CreateRoleResponse, ListRolesResponse, RoleByIdResponse, AssignPermissionsResponse, PermissionsByRoleResponse } from ".";
import Role from "../models/Role";

const roleApi = axios.create({
    baseURL: `${BASE_URL}/roles`,
    timeout: DEFAULT_TIMEOUT,
});

export const createRole = async (roleData: Partial<Role>, token: string): Promise<CreateRoleResponse> => {
    try {
        const response = await roleApi.post<CreateRoleResponse>("", roleData, {
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
        const response = await roleApi.get<ListRolesResponse>("", {
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
        const response = await roleApi.get<RoleByIdResponse>(`/${roleID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching role by ID (${roleID}):`, error);
        throw error;
    }
};

export const updateRole = async (roleID: string, roleData: Partial<Role>, token: string): Promise<RoleByIdResponse> => {
    try {
        const response = await roleApi.put<RoleByIdResponse>(`/${roleID}`, roleData, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error updating role (${roleID}):`, error);
        throw error;
    }
};

export const deleteRole = async (roleID: string, token: string): Promise<void> => {
    try {
        await roleApi.delete(`/${roleID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
    } catch (error) {
        console.error(`Error deleting role (${roleID}):`, error);
        throw error;
    }
};

export const assignPermissionsToRole = async (
    roleID: string,
    permissionIDs: string[],
    token: string
): Promise<AssignPermissionsResponse> => {
    try {
        const response = await roleApi.post<AssignPermissionsResponse>(
            `/${roleID}/permissions`,
            { permissionIDs },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (error) {
        console.error(`Error assigning permissions to role (${roleID}):`, error);
        throw error;
    }
};

export const getPermissionsByRole = async (roleID: string, token: string): Promise<PermissionsByRoleResponse> => {
    try {
        const response = await roleApi.get<PermissionsByRoleResponse>(`/${roleID}/permissions`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching permissions for role (${roleID}):`, error);
        throw error;
    }
};