import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AxiosErrorResponse } from '../apis/index';

interface ErrorContextType {
    error: string | null;
    setError: (error: unknown, persist?: boolean, timeout?: number) => void;
    clearError: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const ErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [error, setErrorState] = useState<string | null>(null);

    const handleApiError = (error: unknown, defaultMessage: string): string => {
        if (error instanceof Error && 'response' in error) {
            const axiosError = error as AxiosErrorResponse;
            if (axiosError.response?.data?.error) {
                return axiosError.response.data.error;
            }
            if (axiosError.response?.status === 401) {
                return 'Please log in to continue.';
            }
            if (axiosError.response?.status === 403) {
                return axiosError.response.data?.error?.includes('locked')
                    ? 'Account temporarily locked. Please wait and try again.'
                    : 'You don’t have permission to perform this action.';
            }
            if (axiosError.response?.status === 429) {
                return 'Too many login attempts. Please wait before trying again.';
            }
            if (axiosError.response?.status === 500) {
                return 'Something went wrong on our end. Please try again later.';
            }
        }
        return defaultMessage;
    };

    const setError = (error: unknown, persist: boolean = false, timeout: number = 3000) => {
        if (!error) {
            setErrorState(null);
            return;
        }
        if (typeof error === 'string') {
            setErrorState(error);
            if (!persist) {
                setTimeout(() => setErrorState(null), timeout);
            }
            return;
        }
        let defaultMessage = 'Something went wrong. Please try again.';
        if (error instanceof Error && error.message === 'No refresh token available') {
            defaultMessage = error.message;
        }
        const message = handleApiError(error, defaultMessage);
        setErrorState(message);
        if (!persist) {
            setTimeout(() => setErrorState(null), timeout);
        }
    };

    const clearError = () => {
        setErrorState(null);
    };

    return (
        <ErrorContext.Provider value={{ error, setError, clearError }}>
            {children}
        </ErrorContext.Provider>
    );
};

export const useError = () => {
    const context = useContext(ErrorContext);
    if (!context) throw new Error('useError must be used within an ErrorProvider');
    return context;
};