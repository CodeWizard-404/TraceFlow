interface ReceiptStub {
    stubID: string;
    bookID: string;
    status: "pending" | "collected" | "transmitted" | "archived";
}

export default ReceiptStub;