import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ErrorDisplay from '../pages/Error/ErrorDisplay';
import { useError } from '../context/ErrorContext';

interface ErrorItem {
    id: string;
    message: string;
    timestamp: string;
}

const ErrorManager: React.FC = () => {
    const [errors, setErrors] = useState<ErrorItem[]>([]);
    const { setError } = useError();

    // Listen for API errors
    useEffect(() => {
        const handleApiError = (event: Event) => {
            const customEvent = event as CustomEvent<{ error: unknown; url: string }>;
            const error = customEvent.detail.error;

            // Use ErrorContext's setError to process the error message
            setError(error, true); // Persist to get the processed message

            // Create ErrorItem for ErrorDisplay
            let message = 'Something went wrong. Please try again.';
            if (typeof error === 'string') {
                message = error;
            } else if (error instanceof Error) {
                if ('response' in error) {
                    const axiosError = error as any;
                    if (axiosError.response?.data?.error) {
                        message = axiosError.response.data.error;
                    } else if (axiosError.response?.status === 401) {
                        message = 'Please log in to continue.';
                    } else if (axiosError.response?.status === 403) {
                        message = axiosError.response.data?.error?.includes('locked')
                            ? 'Account temporarily locked. Please wait and try again.'
                            : 'You don’t have permission to perform this action.';
                    } else if (axiosError.response?.status === 429) {
                        message = 'Too many login attempts. Please wait before trying again.';
                    } else if (axiosError.response?.status === 500) {
                        message = 'Something went wrong on our end. Please try again later.';
                    }
                } else if (error.message === 'No refresh token available') {
                    message = error.message;
                }
            }

            const errorItem: ErrorItem = {
                id: uuidv4(),
                message,
                timestamp: new Date().toISOString(),
            };

            setErrors((prev) => [...prev, errorItem]);
        };

        window.addEventListener('apiError', handleApiError);
        return () => {
            window.removeEventListener('apiError', handleApiError);
        };
    }, [setError]);

    const clearError = (id: string) => {
        setErrors((prev) => prev.filter((error) => error.id !== id));
    };

    const clearAllErrors = () => {
        setErrors([]);
    };

    return <ErrorDisplay errors={errors} clearError={clearError} clearAllErrors={clearAllErrors} />;
};

export default ErrorManager;