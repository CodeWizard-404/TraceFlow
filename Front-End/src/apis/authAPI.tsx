import api from "./axiosConfig";
import { LoginResponse, Verify2FAResponse, Resend2FAResponse } from ".";



export const login = async (identifier: string, password: string, deviceIdentifier: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>("/auth/login", { identifier, password, deviceIdentifier });
    return response.data;
};

export const verify2FA = async (userID: string, otpCode: string, deviceIdentifier: string, trustDevice: boolean): Promise<Verify2FAResponse> => {
    const response = await api.post<Verify2FAResponse>("/auth/verify-2fa", { userID, otpCode, deviceIdentifier, trustDevice });
    return response.data;
};

export const resend2FA = async (userID: string): Promise<Resend2FAResponse> => {
    try {
        const response = await api.post<Resend2FAResponse>("/auth/resend-2fa", { userID });
        return response.data;
    } catch (error) {
        console.error("Error resending 2FA:", error);
        throw error;
    }
};

export const initiatePasswordReset = async (identifier: string): Promise<{ userID: string; message: string }> => {
    try {
        const response = await api.post("/auth/password-reset/initiate", { identifier });
        return response.data;
    } catch (error) {
        console.error("Error initiating password reset:", error);
        throw error;
    }
};

export const verifyPasswordResetOTP = async (userID: string, otpCode: string): Promise<{ userID: string; message: string }> => {
    try {
        const response = await api.post("/auth/password-reset/verify", { userID, otpCode });
        return response.data;
    } catch (error) {
        console.error("Error verifying password reset OTP:", error);
        throw error;
    }
};

export const resetPassword = async (userID: string, newPassword: string): Promise<{ message: string }> => {
    try {
        const response = await api.post("/auth/password-reset/reset", { userID, newPassword });
        return response.data;
    } catch (error) {
        console.error("Error resetting password:", error);
        throw error;
    }
};