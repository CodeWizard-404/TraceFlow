import api from './axiosConfig';
import {
    InitiatePasswordResetResponse,
    LoginResponse,
    Resend2FAResponse,
    ResetPasswordResponse,
    Verify2FAResponse,
    VerifyPasswordResetOTPResponse,
} from './index';

interface AxiosErrorResponse {
    response?: {
        data?: {
            error?: string;
        };
        status?: number;
    };
}

const handleApiError = (error: unknown, defaultMessage: string): string => {
    if (error instanceof Error && 'response' in error) {
        const axiosError = error as AxiosErrorResponse;
        if (axiosError.response?.data?.error) {
            return axiosError.response.data.error;
        }
        switch (axiosError.response?.status) {
            case 400:
                return 'Invalid request. Please check your input.';
            case 401:
                return 'Authentication failed. Please log in again.';
            case 403:
                return 'You don’t have permission to perform this action.';
            case 404:
                return 'Resource not found.';
            case 500:
                return 'Server error. Please try again later.';
            default:
                return defaultMessage;
        }
    }
    return defaultMessage;
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

export const logout = async (): Promise<void> => {
    try {
        await api.post('/auth/logout');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        localStorage.removeItem('supervisorFilter');
    } catch (error) {
        throw new Error(handleApiError(error, 'Logout failed'));
    }
};

export const refreshToken = async (): Promise<void> => {
    try {
        await api.post('/auth/refresh');
    } catch (error) {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('supervisorFilter');
        throw new Error(handleApiError(error, 'Unable to refresh session'));
    }
};

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

export const initiatePasswordReset = async (
    identifier: string
): Promise<InitiatePasswordResetResponse> => {
    try {
        const response = await api.post<InitiatePasswordResetResponse>("/auth/password-reset/initiate", { identifier });
        return response.data;
    } catch (error) {
        throw new Error(
            handleApiError(error, "Unable to initiate password reset. Please check your email or phone and try again.")
        );
    }
};

export const verifyPasswordResetOTP = async (
    userID: string,
    otpCode: string
): Promise<VerifyPasswordResetOTPResponse> => {
    try {
        const response = await api.post<VerifyPasswordResetOTPResponse>("/auth/password-reset/verify", {
            userID,
            otpCode,
        });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to verify OTP. Please check your OTP and try again."));
    }
};

export const resetPassword = async (
    userID: string,
    newPassword: string,
    tempToken: string
): Promise<ResetPasswordResponse> => {
    try {
        const response = await api.post<ResetPasswordResponse>("/auth/password-reset/reset", {
            userID,
            newPassword,
            tempToken,
        });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to reset password. Please try again."));
    }
};