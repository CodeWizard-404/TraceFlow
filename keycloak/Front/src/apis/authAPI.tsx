// frontend/src/apis/authAPI.tsx

import api from './axiosConfig';
import {
    LoginResponse,
    Verify2FAResponse,
    InitiatePasswordResetResponse,
    Resend2FAResponse,
    VerifyPasswordResetOTPResponse,
    ResetPasswordResponse,
} from './index';

interface AxiosErrorResponse {
    response?: {
        status?: number;
        data?: {
            error?: string;
            waitTime?: number;
            failureCount?: number;
        };
    };
}

const handleApiError = (error: unknown, defaultMessage: string): string => {
    const axiosError = error as AxiosErrorResponse;
    if (axiosError.response?.data?.error) {
        return axiosError.response.data.error; // Use backend's error message
    }
    switch (axiosError.response?.status) {
        case 400:
            return 'Invalid request. Please check your input.';
        case 401:
            return 'Wrong email or password.';
        case 403:
            return 'Account locked or access denied.';
        case 404:
            return 'Account not found.';
        case 429:
            return 'Too many attempts. Please wait.';
        case 500:
            return 'Server error. Please try again.';
        default:
            return defaultMessage;
    }
};

export const login = async (
    identifier: string,
    password: string,
    deviceIdentifier: string,
    otpMethod: string
): Promise<LoginResponse> => {
    try {
        const response = await api.post('/auth/login', {
            identifier,
            password,
            deviceIdentifier,
            otpMethod,
        });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Login failed'));
    }
};

export const verify2FA = async (
    userID: string,
    otpCode: string,
    deviceIdentifier: string,
    trustDevice: boolean,
    tempToken: string,
    refreshToken: string
): Promise<Verify2FAResponse> => {
    try {
        const response = await api.post('/auth/verify-2fa', {
            userID,
            otpCode,
            deviceIdentifier,
            trustDevice,
            tempToken,
            refreshToken,
        });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, '2FA verification failed'));
    }
};

export const refreshToken = async (): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> => {
    try {
        const response = await api.post('/auth/refresh');
        return response.data;
    } catch (error) {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('supervisorFilter');
        throw new Error(handleApiError(error, 'Unable to refresh session'));
    }
};

export const logout = async (): Promise<void> => {
    try {
        await api.post('/auth/logout');
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('supervisorFilter');
    } catch (error) {
        throw new Error(handleApiError(error, 'Logout failed'));
    }
};

export const resend2FA = async (userID: string, otpMethod: string): Promise<Resend2FAResponse> => {
    try {
        const response = await api.post('/auth/resend-2fa', { userID, otpMethod });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Resend 2FA failed'));
    }
};

export const initiatePasswordReset = async (identifier: string): Promise<InitiatePasswordResetResponse> => {
    try {
        const response = await api.post('/auth/reset-password/init', { identifier });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Password reset initiation failed'));
    }
};

export const verifyPasswordResetOTP = async (userID: string, otpCode: string): Promise<VerifyPasswordResetOTPResponse> => {
    try {
        const response = await api.post('/auth/reset-password/verify', { userID, otpCode });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Password reset OTP verification failed'));
    }
};

export const resetPassword = async (userID: string, newPassword: string, tempToken: string): Promise<ResetPasswordResponse> => {
    try {
        const response = await api.post('/auth/reset-password', { userID, newPassword, tempToken });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Password reset failed'));
    }
};