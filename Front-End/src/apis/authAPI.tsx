import api from "./axiosConfig";

import { LoginResponse } from ".";

export const login = async (identifier: string, password: string): Promise<LoginResponse> => {
    try {
        const response = await api.post<LoginResponse>("/auth/login", { identifier, password });
        return response.data;
    } catch (error) {
        console.error("Error during login:", error);
        throw error;
    }
};

