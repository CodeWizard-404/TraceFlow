import { AxiosError } from "axios";
import api from "./axiosConfig";
import {
    CreateReceiptBookResponse,
    ListReceiptBooksResponse,
    ReceiptBookByIdResponse,
    UpdateReceiptBookResponse,
    DeleteReceiptBookResponse,
    SendToSupplierResponse,
    TransferResponse,
    ValidateTransferResponse,
    TransferHistoryResponse,
    ReceiveFromSupplierResponse,
} from ".";
import ReceiptBook from "../models/ReceiptBook";

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
            return "Receipt book not found.";
        case 500:
            return "Something went wrong on our end. Please try again later.";
        default:
            return defaultMessage;
    }
};

// Create a new receipt book
export const createReceiptBook = async (data: { number: string; type: string }): Promise<CreateReceiptBookResponse> => {
    try {
        if (!data.number || !data.type) {
            throw new Error("Number and type are required.");
        }
        const response = await api.post<CreateReceiptBookResponse>("/receipt-books", data);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to create receipt book."));
    }
};

// Get all receipt books
export const getAllReceiptBooks = async (): Promise<ListReceiptBooksResponse> => {
    try {
        const response = await api.get<ListReceiptBooksResponse>("/receipt-books");
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch all receipt books."));
    }
};

// Get receipt book by ID
export const getReceiptBookById = async (bookID: string): Promise<ReceiptBookByIdResponse> => {
    try {
        if (!bookID) {
            throw new Error("Book ID is required.");
        }
        const response = await api.get<ReceiptBookByIdResponse>(`/receipt-books/${bookID}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Receipt book not found."));
    }
};

// Get receipt books by holder
export const getReceiptBooksByHolder = async (
    holderID: string,
    userType: string
): Promise<ReceiptBook[]> => {
    try {
        if (!holderID || !userType) {
            throw new Error("Holder ID and user type are required.");
        }
        const response = await api.post<ListReceiptBooksResponse>(`/receipt-books/holder/${holderID}`, { userType });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch receipt books by holder."));
    }
};

// Update a receipt book
export const updateReceiptBook = async (
    bookID: string,
    data: Partial<ReceiptBook>
): Promise<UpdateReceiptBookResponse> => {
    try {
        if (!bookID) {
            throw new Error("Book ID is required.");
        }
        const response = await api.put<UpdateReceiptBookResponse>(`/receipt-books/${bookID}`, data);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to update receipt book."));
    }
};

// Delete a receipt book
export const deleteReceiptBook = async (bookID: string): Promise<DeleteReceiptBookResponse> => {
    try {
        if (!bookID) {
            throw new Error("Book ID is required.");
        }
        const response = await api.delete<DeleteReceiptBookResponse>(`/receipt-books/${bookID}`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to delete receipt book."));
    }
};

// Send receipt books to supplier
export const sendToSupplier = async (
    bookIDs: string[],
    supplierEmail: string
): Promise<SendToSupplierResponse> => {
    try {
        if (!Array.isArray(bookIDs) || !supplierEmail) {
            throw new Error("Book IDs (array) and supplier email are required.");
        }
        const response = await api.post<SendToSupplierResponse>("/receipt-books/send", { bookIDs, supplierEmail });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to send receipt books to supplier."));
    }
};

// Collect receipt books from supplier
export const collectFromSupplier = async (
    bookIDs: string[],
    userID: string
): Promise<ReceiveFromSupplierResponse> => {
    try {
        if (!Array.isArray(bookIDs) || !userID) {
            throw new Error("Book IDs (array) and user ID are required.");
        }
        const response = await api.post<ReceiveFromSupplierResponse>("/receipt-books/receive", { bookIDs, userID });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to collect receipt books from supplier."));
    }
};

// Transfer receipt books
export const transfer = async (
    bookIDs: string[],
    recipientID: string,
    recipientType: "user" | "agent"
): Promise<TransferResponse> => {
    try {
        if (!Array.isArray(bookIDs) || !recipientID) {
            throw new Error("Book IDs (array) and recipient ID are required.");
        }
        const response = await api.post<TransferResponse>("/receipt-books/transfer", { bookIDs, recipientID, recipientType });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to transfer receipt books."));
    }
};

// Validate receipt book transfer
export const validateTransfer = async (
    bookIDs: string[],
    recipientID: string,
    otpCode: string,
    recipientType: "user" | "agent"
): Promise<ValidateTransferResponse> => {
    try {
        if (!Array.isArray(bookIDs) || !recipientID || !otpCode) {
            throw new Error("Book IDs (array), recipient ID, and OTP code are required.");
        }
        const response = await api.post<ValidateTransferResponse>("/receipt-books/validate-transfer", {
            bookIDs,
            recipientID,
            otpCode,
            recipientType,
        });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to validate transfer."));
    }
};

// Get transfer history for a receipt book
export const getTransferHistory = async (bookID: string): Promise<TransferHistoryResponse> => {
    try {
        if (!bookID) {
            throw new Error("Book ID is required.");
        }
        const response = await api.get<TransferHistoryResponse>(`/receipt-books/${bookID}/history`);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to fetch transfer history for receipt book."));
    }
};