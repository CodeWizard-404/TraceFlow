interface ReceiptStub {
    stubID: string;
    bookID: string;
    status: "pending" | "collected" | "transmitted" | "archived";
    createdAt?: string;
    updatedAt?: string;
}

export default ReceiptStub;