import api from "./axiosConfig";
import { CollectStubResponse, ValidateStubCollectionResponse, ArchiveStubResponse } from ".";

export const collectStub = async (bookID: string, token: string): Promise<CollectStubResponse> => {
    try {
        const response = await api.post<CollectStubResponse>(`/receipt-stubs/${bookID}/collect`, {}, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error collecting stub for book (${bookID}):`, error);
        throw error;
    }
};

export const validateStubCollection = async (
    bookID: string,
    otpCode: string,
    token: string
): Promise<ValidateStubCollectionResponse> => {
    try {
        const response = await api.post<ValidateStubCollectionResponse>(`/receipt-stubs/${bookID}/validate-collection`, { otpCode }, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error validating stub collection for book (${bookID}):`, error);
        throw error;
    }
};

export const archiveStub = async (bookID: string, token: string): Promise<ArchiveStubResponse> => {
    try {
        const response = await api.post<ArchiveStubResponse>(`/receipt-stubs/${bookID}/archive`, {}, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error(`Error archiving stub for book (${bookID}):`, error);
        throw error;
    }
};