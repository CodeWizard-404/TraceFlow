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
    ReceiptBookBulkUploadResponse,
} from ".";
import ReceiptBook from "../models/ReceiptBook";
import ReceiptBookType from "models/ReceiptBookType";
import { v4 as uuidv4 } from 'uuid';
import User from "models/User";

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
            return "Receipt book not found.";
        case 500:
            return "Something went wrong on our end. Please try again later.";
        default:
            return defaultMessage;
    }
};

// Create a new receipt book
export const createReceiptBook = async (data: Partial<ReceiptBook>): Promise<CreateReceiptBookResponse> => {
    try {
        const payload = {
            number: data.number,
            typeID: data.typeID,
            status: data.status,
            agentID: data.agentID,
        };
        const response = await api.post<CreateReceiptBookResponse>("/receipt-books", payload);
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, "Unable to create receipt book."));
    }
};

// Get all receipt books
export const getAllReceiptBooks = async (
    page = 1,
    limit = 10,
    sortField: 'number' | 'holder' | 'bookStatus' | 'stubStatus' | 'type' = 'number',
    sortOrder: 'ASC' | 'DESC' = 'ASC',
    searchQuery = '',
    filterType = 'all',
    filterStatus = 'all'
) => {
    try {
        const response = await api.get(
            `/receipt-books?page=${page}&limit=${limit}&sortField=${sortField}&sortOrder=${sortOrder}&searchQuery=${encodeURIComponent(searchQuery)}&filterType=${filterType}&filterStatus=${filterStatus}`
        );
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to fetch all receipt books.'));
    }
};

// Get receipt book by ID
export const getReceiptBookById = async (bookID: string): Promise<ReceiptBookByIdResponse> => {
    try {
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
        const payload = {
            number: data.number,
            typeID: data.typeID,
        };
        const response = await api.put<UpdateReceiptBookResponse>(`/receipt-books/${bookID}`, payload);
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
        const CHUNK_SIZE = 100; // Process 100 books per request
        const transferID = uuidv4(); // Generate a unique transfer ID for this batch
        const chunks = [];

        // Split bookIDs into chunks of 100
        for (let i = 0; i < bookIDs.length; i += CHUNK_SIZE) {
            chunks.push(bookIDs.slice(i, i + CHUNK_SIZE));
        }

        // Send each chunk as a partial request
        for (const chunk of chunks) {
            await api.post<SendToSupplierResponse>(
                "/receipt-books/send",
                { transferID, bookIDs: chunk, supplierEmail, isPartial: true },
                { timeout: 60000 } // 60-second timeout per chunk
            );
        }

        // Send final request to trigger email
        const finalResponse = await api.post<SendToSupplierResponse>(
            "/receipt-books/send",
            { transferID, supplierEmail, isPartial: false },
            { timeout: 120000 } // 120-second timeout for final request
        );
        return finalResponse.data;
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


// Fetch all receipt book types
export const getAllReceiptBookTypes = async (): Promise<ReceiptBookType[]> => {
    try {
        const response = await api.get(`/receipt-books/types`, {
            headers: { 'Accept': 'application/json' },
        });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Failed to fetch receipt book types'));
    }
};

// Fetch a single receipt book type by ID
export const getReceiptBookTypeById = async (typeID: string): Promise<ReceiptBookType> => {
    try {
        const response = await api.get(`/receipt-books/types/${typeID}`, {
            headers: { 'Accept': 'application/json' },
        });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Failed to fetch receipt book type'));
    }
};

// Create a new receipt book type
export const createReceiptBookType = async (data: Partial<ReceiptBookType>): Promise<ReceiptBookType> => {
    try {
        const response = await api.post(`/receipt-books/types`, data, {
            headers: { 'Content-Type': 'application/json' },
        });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Failed to create receipt book type'));
    }
};

// Update a receipt book type
export const updateReceiptBookType = async (typeID: string, data: Partial<ReceiptBookType>): Promise<ReceiptBookType> => {
    try {
        const response = await api.put(`/receipt-books/types/${typeID}`, data, {
            headers: { 'Content-Type': 'application/json' },
        });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Failed to update receipt book type'));
    }
};

// Delete a receipt book type
export const deleteReceiptBookType = async (typeID: string): Promise<void> => {
    try {
        await api.delete(`/receipt-books/types/${typeID}`);
    } catch (error) {
        throw new Error(handleApiError(error, 'Failed to delete receipt book type'));
    }
};


// Upload receipt books via CSV
export const uploadReceiptBooks = async (
    file: File,
    onProgress?: (percentage: number) => void
): Promise<ReceiptBookBulkUploadResponse> => {
    try {
        if (!file) {
            throw new Error('CSV file is required.');
        }
        const formData = new FormData();
        formData.append('csvFile', file);
        const response = await api.post<ReceiptBookBulkUploadResponse>('/receipt-books/upload-csv', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
                if (progressEvent.total && onProgress) {
                    const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percentage);
                }
            },
        });
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Unable to upload receipt books CSV.'));
    }
};


/**
 * Fetch all unique receipt book holders with their roles.
 * @returns {Promise<User[]>} Array of users with their roles.
 */
export const getReceiptBookHolders = async (): Promise<User[]> => {
    try {
        const response = await api.get('/receipt-books/holders');
        return response.data;
    } catch (error) {
        throw new Error(handleApiError(error, 'Failed to fetch receipt book holders.'));
    }
};



export default {
    getAllReceiptBooks,
    getReceiptBookById,
    createReceiptBook,
    updateReceiptBook,
    deleteReceiptBook,
    validateTransfer,
    getTransferHistory,
    getAllReceiptBookTypes,
    getReceiptBookTypeById,
    createReceiptBookType,
    updateReceiptBookType,
    deleteReceiptBookType,
    uploadReceiptBooks,
    getReceiptBooksByHolder,
    getReceiptBookHolders
};


