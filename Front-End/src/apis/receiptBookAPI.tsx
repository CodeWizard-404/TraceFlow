import axios from "axios";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";
import {
    CreateReceiptBookResponse,
    ListReceiptBooksResponse,
    ReceiptBookByIdResponse,
    SendToSupplierResponse,
    TransferToUserResponse,
    ValidateTransferResponse,
    AssignToAgentResponse,
    ValidateAgentAssignmentResponse,
    TransferHistoryResponse,
} from ".";
import ReceiptBook from "../models/ReceiptBook";

const receiptBookApi = axios.create({
    baseURL: `${BASE_URL}/receipt-books`,
    timeout: DEFAULT_TIMEOUT,
});

export const createReceiptBook = async (
    receiptBookData: Partial<ReceiptBook>,
    token: string
): Promise<CreateReceiptBookResponse> => {
    try {
        const response = await receiptBookApi.post<CreateReceiptBookResponse>("", receiptBookData, {
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
        const response = await receiptBookApi.get<ListReceiptBooksResponse>("", {
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
        const response = await receiptBookApi.get<ReceiptBookByIdResponse>(`/${bookID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching receipt book by ID (${bookID}):`, error);
        throw error;
    }
};

export const updateReceiptBook = async (bookID: string, receiptBookData: Partial<ReceiptBook>, token: string): Promise<ReceiptBookByIdResponse> => {
    try {
        const response = await receiptBookApi.put<ReceiptBookByIdResponse>(`/${bookID}`, receiptBookData, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error updating receipt book (${bookID}):`, error);
        throw error;
    }
};

export const deleteReceiptBook = async (bookID: string, token: string): Promise<void> => {
    try {
        await receiptBookApi.delete(`/${bookID}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
    } catch (error) {
        console.error(`Error deleting receipt book (${bookID}):`, error);
        throw error;
    }
};

export const sendToSupplier = async (
    bookID: string,
    supplierEmail: string,
    token: string
): Promise<SendToSupplierResponse> => {
    try {
        const response = await receiptBookApi.post<SendToSupplierResponse>(
            "/send",
            { bookID, supplierEmail },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (error) {
        console.error(`Error sending receipt book (${bookID}) to supplier:`, error);
        throw error;
    }
};

export const transferToUser = async (bookID: string, token: string): Promise<TransferToUserResponse> => {
    try {
        const response = await receiptBookApi.post<TransferToUserResponse>(
            "/transfer",
            { bookID },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (error) {
        console.error(`Error transferring receipt book (${bookID}) to user:`, error);
        throw error;
    }
};

export const validateTransferToUser = async (
    bookID: string,
    otpCode: string,
    token: string
): Promise<ValidateTransferResponse> => {
    try {
        const response = await receiptBookApi.post<ValidateTransferResponse>(
            "/validate-transfer",
            { bookID, otpCode },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (error) {
        console.error(`Error validating transfer for receipt book (${bookID}):`, error);
        throw error;
    }
};

export const assignToAgent = async (
    bookID: string,
    agentPhone: string,
    token: string
): Promise<AssignToAgentResponse> => {
    try {
        const response = await receiptBookApi.post<AssignToAgentResponse>(
            "/assign-agent",
            { bookID, agentPhone },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (error) {
        console.error(`Error assigning receipt book (${bookID}) to agent:`, error);
        throw error;
    }
};

export const validateAgentAssignment = async (
    bookID: string,
    agentPhone: string,
    otpCode: string,
    token: string
): Promise<ValidateAgentAssignmentResponse> => {
    try {
        const response = await receiptBookApi.post<ValidateAgentAssignmentResponse>(
            "/validate-agent",
            { bookID, agentPhone, otpCode },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (error) {
        console.error(`Error validating agent assignment for receipt book (${bookID}):`, error);
        throw error;
    }
};

export const getTransferHistory = async (bookID: string, token: string): Promise<TransferHistoryResponse> => {
    try {
        const response = await receiptBookApi.get<TransferHistoryResponse>(`/${bookID}/history`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching transfer history for receipt book (${bookID}):`, error);
        throw error;
    }
};