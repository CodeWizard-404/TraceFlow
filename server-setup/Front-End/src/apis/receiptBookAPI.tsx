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

export const createReceiptBook = async (
    data: { number: string; type: string },
    token: string
): Promise<CreateReceiptBookResponse> => {
    try {
        const response = await api.post<CreateReceiptBookResponse>("/receipt-books", data, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error("Error creating receipt book:", error);
        throw error;
    }
};

export const getAllReceiptBooks = async (token: string): Promise<ListReceiptBooksResponse> => {
    try {
        const response = await api.get<ListReceiptBooksResponse>("/receipt-books", {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching all receipt books:", error);
        throw error;
    }
};

export const getReceiptBookById = async (bookID: string, token: string): Promise<ReceiptBookByIdResponse> => {
    try {
        const response = await api.get<ReceiptBookByIdResponse>(`/receipt-books/${bookID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching receipt book by ID (${bookID}):`, error);
        throw error;
    }
};
export const getReceiptBooksByHolder = async (
    holderID: string,
    token: string,
    userType: string
): Promise<ReceiptBook[]> => {
    try {
        const response = await api.post<ListReceiptBooksResponse>(`/receipt-books/holder/${holderID}`, { userType }, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching receipt books by holder (${holderID}):`, error);
        throw error;
    }
};

export const updateReceiptBook = async (
    bookID: string,
    data: Partial<ReceiptBook>,
    token: string
): Promise<UpdateReceiptBookResponse> => {
    try {
        const response = await api.put<UpdateReceiptBookResponse>(`/receipt-books/${bookID}`, data, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error updating receipt book (${bookID}):`, error);
        throw error;
    }
};

export const deleteReceiptBook = async (bookID: string, token: string): Promise<DeleteReceiptBookResponse> => {
    try {
        const response = await api.delete<DeleteReceiptBookResponse>(`/receipt-books/${bookID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error deleting receipt book (${bookID}):`, error);
        throw error;
    }
};

export const sendToSupplier = async (
    bookIDs: string[],
    supplierEmail: string,
    token: string
): Promise<SendToSupplierResponse> => {
    try {
        const response = await api.post<SendToSupplierResponse>("/receipt-books/send", { bookIDs, supplierEmail }, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error("Error sending receipt books to supplier:", error);
        throw error;
    }
};

export const collectFromSupplier = async (
    bookIDs: string[],
    userID: string,
    token: string
): Promise<ReceiveFromSupplierResponse> => {
    try {
        const response = await api.post<ReceiveFromSupplierResponse>("/receipt-books/receive", { bookIDs, userID }, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error("Error collecting receipt books from supplier:", error);
        throw error;
    }
};

export const transfer = async (
    bookIDs: string[],
    recipientID: string,
    recipientType: "user" | "agent",
    token: string
): Promise<TransferResponse> => {
    try {
        const response = await api.post<TransferResponse>("/receipt-books/transfer", { bookIDs, recipientID, recipientType }, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error("Error transferring receipt books:", error);
        throw error;
    }
};

export const validateTransfer = async (
    bookIDs: string[],
    recipientID: string,
    otpCode: string,
    recipientType: "user" | "agent",
    token: string
): Promise<ValidateTransferResponse> => {
    try {
        const response = await api.post<ValidateTransferResponse>("/receipt-books/validate-transfer", {
            bookIDs,
            recipientID,
            otpCode,
            recipientType,
        }, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error("Error validating transfer:", error);
        throw error;
    }
};

export const getTransferHistory = async (bookID: string, token: string): Promise<TransferHistoryResponse> => {
    try {
        const response = await api.get<TransferHistoryResponse>(`/receipt-books/${bookID}/history`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching transfer history for receipt book (${bookID}):`, error);
        throw error;
    }
};