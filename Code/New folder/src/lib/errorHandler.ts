import { AxiosError } from "axios";


// Default no-op function for setting errors
let setErrorGlobal = (error: string) => { };

// Function to set the global error handler from the context
export const setSetErrorGlobal = (setErrorFunc: (error: string) => void) => {
    setErrorGlobal = setErrorFunc;
};

// Reusable API error handler that sets the error and throws it
export const apiErrorHandler = (error: unknown, defaultMessage: string): never => {
    const axiosError = error as AxiosError<{ error?: string }>;
    let errorMsg: string;

    if (axiosError?.response?.data?.error) {
        errorMsg = axiosError.response.data.error;
    } else {
        switch (axiosError?.response?.status) {
            case 400:
                errorMsg = "Invalid request. Please check your input.";
                break;
            case 401:
                errorMsg = "Please log in to continue.";
                break;
            case 403:
                errorMsg = "Unauthorized.";
                break;
            case 404:
                errorMsg = "Resource not found.";
                break;
            case 500:
                errorMsg = "Server error. Please try again later.";
                break;
            default:
                errorMsg = defaultMessage;
        }
    }

    setErrorGlobal(errorMsg);
    throw new Error(errorMsg);
};