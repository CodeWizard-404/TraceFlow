import api from "./axiosConfig";
import { LoginResponse, Verify2FAResponse, Resend2FAResponse } from ".";

export const login = async (identifier: string, password: string): Promise<LoginResponse> => {
    try {
        const response = await api.post<LoginResponse>("/auth/login", { identifier, password });
        return response.data;
    } catch (error) {
        console.error("Error during login:", error);
        throw error;
    }
};

export const verify2FA = async (userID: string, otpCode: string): Promise<Verify2FAResponse> => {
    try {
        const response = await api.post<Verify2FAResponse>("/auth/verify2fa", { userID, otpCode });
        return response.data;
    } catch (error) {
        console.error("Error during 2FA verification:", error);
        throw error;
    }
};

export const resend2FA = async (userID: string): Promise<Resend2FAResponse> => {
    try {
        const response = await api.post<Resend2FAResponse>("/auth/resend2fa", { userID });
        return response.data;
    } catch (error) {
        console.error("Error resending 2FA:", error);
        throw error;
    }
};