import axios from "axios";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";
import { LoginResponse } from ".";

const authApi = axios.create({
    baseURL: `${BASE_URL}/auth`,
    timeout: DEFAULT_TIMEOUT,
});

export const login = async (identifier: string, password: string): Promise<LoginResponse> => {
    const response = await authApi.post<LoginResponse>("/login", { identifier, password });
    return response.data;
};