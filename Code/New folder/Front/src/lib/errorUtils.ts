import { useError } from '../context/ErrorContext';

// Store the setError function to be used outside React components
let globalSetError: ((error: unknown, persist?: boolean, timeout?: number) => void) | null = null;

// Hook to set the global setError function
export const useSetGlobalError = () => {
    const { setError } = useError();
    globalSetError = setError;
};

// Function to set error globally
export const setGlobalError = (error: unknown, persist: boolean = false, timeout: number = 3000) => {
    if (globalSetError) {
        globalSetError(error, persist, timeout);
    } else {
        console.warn('Global error handler not initialized');
    }
};