import axios from "axios";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";
import { CreateRoleResponse, ListRolesResponse, RoleByIdResponse, AssignPermissionsResponse, PermissionsByRoleResponse } from ".";
import Role from "../models/Role";

const roleApi = axios.create({
    baseURL: `${BASE_URL}/roles`,
    timeout: DEFAULT_TIMEOUT,
});

export const createRole = async (roleData: Partial<Role>, token: string): Promise<CreateRoleResponse> => {
    const response = await roleApi.post<CreateRoleResponse>("", roleData, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const getAllRoles = async (token: string): Promise<ListRolesResponse> => {
    const response = await roleApi.get<ListRolesResponse>("", {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const getRoleById = async (roleID: string, token: string): Promise<RoleByIdResponse> => {
    const response = await roleApi.get<RoleByIdResponse>(`/${roleID}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const assignPermissionsToRole = async (
    roleID: string,
    permissionIDs: string[],
    token: string
): Promise<AssignPermissionsResponse> => {
    const response = await roleApi.post<AssignPermissionsResponse>(
        `/${roleID}/permissions`,
        { permissionIDs },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};

export const getPermissionsByRole = async (roleID: string, token: string): Promise<PermissionsByRoleResponse> => {
    const response = await roleApi.get<PermissionsByRoleResponse>(`/${roleID}/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};