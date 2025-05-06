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
            message?: string;
            error_description?: string;
            waitTime?: number;
            failureCount?: number;
        };
    };
}

const handleApiError = (error: unknown, defaultMessage: string): string => {
    const axiosError = error as AxiosErrorResponse;
    console.debug('handleApiError:', { error, axiosError });

    // Check for backend error messages in multiple possible fields
    const errorMessage =
        axiosError.response?.data?.error ||
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error_description;

    if (errorMessage) {
        console.debug('Extracted error message:', errorMessage);
        return errorMessage; // e.g., "Wrong email or password"
    }

    // Fallback to status-based messages
    switch (axiosError.response?.status) {
        case 400:
            return 'Invalid request. Please check your input.';
        case 401:
            return 'Authentication failed. Please check your credentials.';
        case 403:
            return 'Account locked or access denied.';
        case 404:
            return 'Account not found.';
        case 429:
            return 'Too many attempts. Please wait.';
        case 500:
            return 'Server error. Please try again later.';
        default:
            console.warn('Falling back to default message:', defaultMessage);
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
            deviceIdentifier,
            password,
            otpMethod,
        });
        console.debug('Login response:', response.data);
        return response.data;
    } catch (error) {
        const errorMessage = handleApiError(error, 'An unexpected error occurred during login');
        console.error('Login API error:', errorMessage, { error });
        throw new Error(errorMessage);
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
        console.debug('Verify2FA response:', response.data);
        return response.data;
    } catch (error) {
        const errorMessage = handleApiError(error, '2FA verification failed');
        console.error('Verify2FA API error:', errorMessage, { error });
        throw new Error(errorMessage);
    }
};

export const refreshToken = async (): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> => {
    try {
        const response = await api.post('/auth/refresh');
        console.debug('Refresh token response:', response.data);
        return response.data;
    } catch (error) {
        document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'userData=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        const errorMessage = handleApiError(error, 'Unable to refresh session');
        console.error('Refresh token API error:', errorMessage, { error });
        throw new Error(errorMessage);
    }
};

export const logout = async (): Promise<void> => {
    try {
        await api.post('/auth/logout');
        document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'userData=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        console.debug('Logout successful');
    } catch (error) {
        const errorMessage = handleApiError(error, 'Logout failed');
        console.error('Logout API error:', errorMessage, { error });
        throw new Error(errorMessage);
    }
};

export const resend2FA = async (userID: string, otpMethod: string): Promise<Resend2FAResponse> => {
    try {
        const response = await api.post('/auth/resend-2fa', { userID, otpMethod });
        console.debug('Resend2FA response:', response.data);
        return response.data;
    } catch (error) {
        const errorMessage = handleApiError(error, 'Failed to resend OTP');
        console.error('Resend2FA API error:', errorMessage, { error });
        throw new Error(errorMessage);
    }
};

export const initiatePasswordReset = async (identifier: string): Promise<InitiatePasswordResetResponse> => {
    try {
        const response = await api.post('/auth/reset-password/init', { identifier });
        console.debug('Initiate password reset response:', response.data);
        return response.data;
    } catch (error) {
        const errorMessage = handleApiError(error, 'Password reset initiation failed');
        console.error('Initiate password reset API error:', errorMessage, { error });
        throw new Error(errorMessage);
    }
};

export const verifyPasswordResetOTP = async (userID: string, otpCode: string): Promise<VerifyPasswordResetOTPResponse> => {
    try {
        const response = await api.post('/auth/reset-password/verify', { userID, otpCode });
        console.debug('Verify password reset OTP response:', response.data);
        return response.data;
    } catch (error) {
        const errorMessage = handleApiError(error, 'Password reset OTP verification failed');
        console.error('Verify password reset OTP API error:', errorMessage, { error });
        throw new Error(errorMessage);
    }
};

export const resetPassword = async (userID: string, newPassword: string, tempToken: string): Promise<ResetPasswordResponse> => {
    try {
        const response = await api.post('/auth/reset-password', { userID, newPassword, tempToken });
        console.debug('Reset password response:', response.data);
        return response.data;
    } catch (error) {
        const errorMessage = handleApiError(error, 'Password reset failed');
        console.error('Reset password API error:', errorMessage, { error });
        throw new Error(errorMessage);
    }
};