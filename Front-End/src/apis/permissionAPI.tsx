// src/apis/permissionAPI.ts
import axios from "axios";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";
import {  ListPermissionsResponse, PermissionByIdResponse } from ".";

const permissionApi = axios.create({
    baseURL: `${BASE_URL}/permissions`,
    timeout: DEFAULT_TIMEOUT,
});

export const getAllPermissions = async (token: string): Promise<ListPermissionsResponse> => {
    const response = await permissionApi.get<ListPermissionsResponse>("", {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const getPermissionById = async (permissionID: string, token: string): Promise<PermissionByIdResponse> => {
    const response = await permissionApi.get<PermissionByIdResponse>(`/${permissionID}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};