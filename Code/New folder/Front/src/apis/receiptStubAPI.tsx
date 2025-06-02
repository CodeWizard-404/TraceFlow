import { AxiosError } from "axios";
import api from "./axiosConfig";
import { CollectStubResponse, ValidateStubCollectionResponse, ArchiveStubResponse } from ".";

// Error response type for Axios errors
interface AxiosErrorResponse {
    response?: {
        data?: { error?: string; results?: { bookID: string; status: string; result?: any; error?: string }[] };
        status?: number;
    };
}

// Generic error handler
const handleApiError = (error: unknown, defaultMessage: string): string => {
    const axiosError = error as AxiosError<AxiosErrorResponse>;
    if (axiosError.response) {
        return axiosError.message;
    }
    switch (axiosError.status) {
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

// Collect receipt stubs
export const collectStub = async (bookIDs: string[]): Promise<CollectStubResponse> => {
    try {
        if (!bookIDs || !Array.isArray(bookIDs) || bookIDs.length === 0) {
            throw new Error("Array of book IDs is required.");
        }
        const response = await api.post<CollectStubResponse>("/receipt-stubs/collect", { bookIDs });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to collect stubs."));
    }
};

// Validate stub collection
export const validateStubCollection = async (
    bookIDs: string[],
    otpCode: string
): Promise<ValidateStubCollectionResponse> => {
    try {
        if (!bookIDs || !Array.isArray(bookIDs) || bookIDs.length === 0 || !otpCode) {
            throw new Error("Array of book IDs and OTP code are required.");
        }
        const response = await api.post<ValidateStubCollectionResponse>("/receipt-stubs/validate-collection", { bookIDs, otpCode });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to validate stub collection."));
    }
};

// Archive receipt stubs
export const archiveStub = async (bookIDs: string[]): Promise<ArchiveStubResponse> => {
    try {
        if (!bookIDs || !Array.isArray(bookIDs) || bookIDs.length === 0) {
            throw new Error("Array of book IDs is required.");
        }
        const response = await api.post<ArchiveStubResponse>("/receipt-stubs/archive", { bookIDs });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to archive stubs."));
    }
};