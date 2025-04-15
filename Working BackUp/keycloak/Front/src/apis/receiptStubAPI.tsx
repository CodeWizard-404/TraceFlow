import { AxiosError } from "axios";
import api from "./axiosConfig";
import { CollectStubResponse, ValidateStubCollectionResponse, ArchiveStubResponse } from ".";

// Error response type for Axios errors
interface AxiosErrorResponse {
    response?: {
        data?: { error?: string };
        status?: number;
    };
}

// Generic error handler
const handleApiError = (error: unknown, defaultMessage: string): string => {
    const axiosError = error as AxiosError<AxiosErrorResponse>;
    if (axiosError.response?.data) {
        return axiosError.message; // Use backend's user-friendly error
    }
    switch (axiosError.response?.status) {
        case 400:
            return "Invalid request. Please check your input and try again.";
        case 401:
            return "Authentication failed. Please log in again.";
        case 403:
            return "You don’t have permission to perform this action.";
        case 404:
            return "Receipt stub not found.";
        case 500:
            return "Something went wrong on our end. Please try again later.";
        default:
            return defaultMessage;
    }
};

// Collect a receipt stub
export const collectStub = async (bookID: string): Promise<CollectStubResponse> => {
    try {
        if (!bookID) {
            throw new Error("Book ID is required.");
        }
        const response = await api.post<CollectStubResponse>(`/receipt-stubs/${bookID}/collect`, {});
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to collect stub."));
    }
};

// Validate stub collection
export const validateStubCollection = async (
    bookID: string,
    otpCode: string
): Promise<ValidateStubCollectionResponse> => {
    try {
        if (!bookID || !otpCode) {
            throw new Error("Book ID and OTP code are required.");
        }
        const response = await api.post<ValidateStubCollectionResponse>(`/receipt-stubs/${bookID}/validate-collection`, { otpCode });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to validate stub collection."));
    }
};

// Archive a receipt stub
export const archiveStub = async (bookID: string): Promise<ArchiveStubResponse> => {
    try {
        if (!bookID) {
            throw new Error("Book ID is required.");
        }
        const response = await api.post<ArchiveStubResponse>(`/receipt-stubs/${bookID}/archive`, {});
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to archive stub."));
    }
};