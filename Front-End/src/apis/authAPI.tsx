import axios from "axios";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";
import { LoginResponse } from ".";

const authApi = axios.create({
    baseURL: `${BASE_URL}/auth`,
    timeout: DEFAULT_TIMEOUT,
    withCredentials: true, // Include cookies in requests
});

export const login = async (identifier: string, password: string): Promise<LoginResponse> => {
    try {
        const response = await authApi.post<LoginResponse>("/login", { identifier, password });
        const { token, user } = response.data;
        console.log("API Response:", { token, user }); // Debug log
        return response.data;
    } catch (error) {
        console.error("Error during login:", error);
        throw error;
    }
};

