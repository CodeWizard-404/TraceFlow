// src/apis/receiptStubAPI.ts
import axios from "axios";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";
import { CollectStubResponse, ValidateStubCollectionResponse, TransmitStubResponse, ArchiveStubResponse } from ".";

const receiptStubApi = axios.create({
    baseURL: `${BASE_URL}/receipt-stubs`,
    timeout: DEFAULT_TIMEOUT,
});

export const collectStub = async (bookID: string, token: string): Promise<CollectStubResponse> => {
    const response = await receiptStubApi.post<CollectStubResponse>(`/${bookID}/collect`, {}, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const validateStubCollection = async (
    bookID: string,
    otpCode: string,
    token: string
): Promise<ValidateStubCollectionResponse> => {
    const response = await receiptStubApi.post<ValidateStubCollectionResponse>(
        `/${bookID}/validate-collection`,
        { otpCode },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};

export const transmitStub = async (
    bookID: string,
    newOwnerID: string,
    token: string
): Promise<TransmitStubResponse> => {
    const response = await receiptStubApi.post<TransmitStubResponse>(
        `/${bookID}/transmit`,
        { newOwnerID },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};

export const archiveStub = async (bookID: string, token: string): Promise<ArchiveStubResponse> => {
    const response = await receiptStubApi.post<ArchiveStubResponse>(`/${bookID}/archive`, {}, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};