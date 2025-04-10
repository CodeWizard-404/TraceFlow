import api from "./axiosConfig";
import { LoginResponse, Verify2FAResponse, Resend2FAResponse } from ".";



export const login = async (
    identifier: string,
    password: string,
    deviceIdentifier: string,
    otpMethod: "phone" | "email" = "phone"
): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>("/auth/login", {
        identifier,
        password,
        deviceIdentifier,
        otpMethod,
    });
    if (!response.data.requires2FA) {
        localStorage.setItem('accessToken', response.data.token!);
        localStorage.setItem('refreshToken', response.data.refreshToken!);
        localStorage.setItem('expiresIn', response.data.expiresIn!.toString());
        scheduleTokenRefresh(response.data.expiresIn!);
    }
    return response.data;
};

export const verify2FA = async (
    userID: string,
    otpCode: string,
    deviceIdentifier: string,
    trustDevice: boolean,
    tempToken: string,
    refreshToken: string
): Promise<Verify2FAResponse> => {
    const payload = { userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken };
    console.log('Verify 2FA payload:', payload);
    const response = await api.post<Verify2FAResponse>("/auth/verify-2fa", payload);
    localStorage.setItem('accessToken', response.data.token);
    localStorage.setItem('refreshToken', response.data.refreshToken);
    localStorage.setItem('expiresIn', response.data.expiresIn.toString());
    scheduleTokenRefresh(response.data.expiresIn);
    return response.data;
};

export const refreshToken = async (): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token available');

    try {
        const response = await api.post("/auth/refresh", { refreshToken });
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        localStorage.setItem('expiresIn', response.data.expiresIn.toString());
        scheduleTokenRefresh(response.data.expiresIn);
        return response.data;
    } catch (error) {
        console.error("Error refreshing token:", error);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('expiresIn');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('supervisorFilter');
        window.location.href = '/login';
        throw error;
    }
};

const scheduleTokenRefresh = (expiresIn: number) => {
    const bufferTime = 600; // Refresh 1 minute before expiry
    setTimeout(async () => {
        try {
            await refreshToken();
        } catch (error) {
            console.error('Scheduled refresh failed:', error);
        }
    }, (expiresIn - bufferTime) * 1000);
};

// Update axiosConfig to handle 401 errors
api.interceptors.response.use(
    response => response,
    async error => {
        if (error.response?.status === 401 && error.response.data.error === 'Token expired, please refresh') {
            try {
                const newTokens = await refreshToken();
                error.config.headers['Authorization'] = `Bearer ${newTokens.accessToken}`;
                return api(error.config); // Retry original request
            } catch (refreshError) {
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export const resend2FA = async (
    userID: string,
    otpMethod: "phone" | "email" = "phone"
): Promise<Resend2FAResponse> => {
    try {
        const response = await api.post<Resend2FAResponse>("/auth/resend-2fa", { userID, otpMethod });
        return response.data;
    } catch (error) {
        console.error("Error resending 2FA:", error);
        throw error;
    }
};

export const initiatePasswordReset = async (
    identifier: string
): Promise<{ userID: string; message: string }> => {
    try {
        const response = await api.post("/auth/password-reset/initiate", { identifier });
        return response.data;
    } catch (error) {
        console.error("Error initiating password reset:", error);
        throw error;
    }
};

export const verifyPasswordResetOTP = async (
    userID: string,
    otpCode: string
): Promise<{ userID: string; message: string }> => {
    try {
        const response = await api.post("/auth/password-reset/verify", { userID, otpCode });
        return response.data;
    } catch (error) {
        console.error("Error verifying password reset OTP:", error);
        throw error;
    }
};

export const resetPassword = async (
    userID: string,
    newPassword: string
): Promise<{ message: string }> => {
    try {
        const response = await api.post("/auth/password-reset/reset", { userID, newPassword });
        return response.data;
    } catch (error) {
        console.error("Error resetting password:", error);
        throw error;
    }
};