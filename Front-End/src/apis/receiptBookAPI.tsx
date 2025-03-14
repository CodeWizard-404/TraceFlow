// src/apis/receiptBookAPI.ts
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
    const response = await receiptBookApi.post<CreateReceiptBookResponse>("", receiptBookData, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const getAllReceiptBooks = async (token: string): Promise<ListReceiptBooksResponse> => {
    const response = await receiptBookApi.get<ListReceiptBooksResponse>("", {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const getReceiptBookById = async (bookID: string, token: string): Promise<ReceiptBookByIdResponse> => {
    const response = await receiptBookApi.get<ReceiptBookByIdResponse>(`/${bookID}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const sendToSupplier = async (
    bookID: string,
    supplierEmail: string,
    token: string
): Promise<SendToSupplierResponse> => {
    const response = await receiptBookApi.post<SendToSupplierResponse>(
        "/send",
        { bookID, supplierEmail },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};

export const transferToUser = async (bookID: string, token: string): Promise<TransferToUserResponse> => {
    const response = await receiptBookApi.post<TransferToUserResponse>(
        "/transfer",
        { bookID },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};

export const validateTransferToUser = async (
    bookID: string,
    otpCode: string,
    token: string
): Promise<ValidateTransferResponse> => {
    const response = await receiptBookApi.post<ValidateTransferResponse>(
        "/validate-transfer",
        { bookID, otpCode },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};

export const assignToAgent = async (
    bookID: string,
    agentPhone: string,
    token: string
): Promise<AssignToAgentResponse> => {
    const response = await receiptBookApi.post<AssignToAgentResponse>(
        "/assign-agent",
        { bookID, agentPhone },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};

export const validateAgentAssignment = async (
    bookID: string,
    agentPhone: string,
    otpCode: string,
    token: string
): Promise<ValidateAgentAssignmentResponse> => {
    const response = await receiptBookApi.post<ValidateAgentAssignmentResponse>(
        "/validate-agent",
        { bookID, agentPhone, otpCode },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};

export const getTransferHistory = async (bookID: string, token: string): Promise<TransferHistoryResponse> => {
    const response = await receiptBookApi.get<TransferHistoryResponse>(`/${bookID}/history`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};