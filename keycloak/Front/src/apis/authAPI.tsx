// apis/authAPI.ts
import api from "./axiosConfig";
import {
    LoginResponse,
    Verify2FAResponse,
    Resend2FAResponse,
    InitiatePasswordResetResponse,
    VerifyPasswordResetOTPResponse,
    ResetPasswordResponse,
} from "./index";

// Error response type for Axios errors
interface AxiosErrorResponse {
    response?: {
        data?: {
            error?: string;
        };
        status?: number;
    };
}

// Generic error handler
const handleApiError = (error: unknown, defaultMessage: string): string => {
    if (error instanceof Error && "response" in error) {
        const axiosError = error as AxiosErrorResponse;
        if (axiosError.response?.data?.error) {
            return axiosError.response.data.error; // Use backend's user-friendly error
        }
        if (axiosError.response?.status === 401) {
            return "Please log in to continue.";
        }
        if (axiosError.response?.status === 403) {
            return "You don’t have permission to perform this action.";
        }
        if (axiosError.response?.status === 500) {
            return "Something went wrong on our end. Please try again later.";
        }
    }
    return defaultMessage; // Fallback for network errors or unexpected issues
};

// Login API
export const login = async (
    identifier: string,
    password: string,
    deviceIdentifier: string,
    otpMethod: "phone" | "email" = "phone"
): Promise<LoginResponse> => {
    try {
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
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to log in. Please check your credentials and try again."));
    }
};

// Verify 2FA API
export const verify2FA = async (
    userID: string,
    otpCode: string,
    deviceIdentifier: string,
    trustDevice: boolean,
    tempToken: string,
    refreshToken: string
): Promise<Verify2FAResponse> => {
    try {
        const payload = { userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken };
        console.log('Verify 2FA payload:', payload);
        const response = await api.post<Verify2FAResponse>("/auth/verify-2fa", payload);
        localStorage.setItem('accessToken', response.data.token);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        localStorage.setItem('expiresIn', response.data.expiresIn.toString());
        scheduleTokenRefresh(response.data.expiresIn);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to verify 2FA. Please check your OTP and try again."));
    }
};

// Refresh token API
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
        throw new Error(handleApiError(error, "Unable to refresh session. Please log in again."));
    }
};

// Schedule token refresh
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

// Resend 2FA API
export const resend2FA = async (
    userID: string,
    otpMethod: "phone" | "email" = "phone"
): Promise<Resend2FAResponse> => {
    try {
        const response = await api.post<Resend2FAResponse>("/auth/resend-2fa", { userID, otpMethod });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to resend OTP. Please try again."));
    }
};

// Initiate password reset API
export const initiatePasswordReset = async (
    identifier: string
): Promise<InitiatePasswordResetResponse> => {
    try {
        const response = await api.post("/auth/password-reset/initiate", { identifier });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to initiate password reset. Please check your email or phone and try again."));
    }
};

// Verify password reset OTP API
export const verifyPasswordResetOTP = async (
    userID: string,
    otpCode: string
): Promise<VerifyPasswordResetOTPResponse> => {
    try {
        const response = await api.post("/auth/password-reset/verify", { userID, otpCode });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to verify OTP. Please check your OTP and try again."));
    }
};

// Reset password API
export const resetPassword = async (
    userID: string,
    newPassword: string
): Promise<ResetPasswordResponse> => {
    try {
        const response = await api.post("/auth/password-reset/reset", { userID, newPassword });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to reset password. Please try again."));
    }
};