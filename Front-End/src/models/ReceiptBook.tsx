interface ReceiptBook {
    bookID: string;
    number: string;
    type: string;
    qrCode: string;
    status:
    | "In Stock"
    | "Sent to Supplier"
    | "From Supplier"
    | "With Regional Manager"
    | "With Supervisor"
    | "Assigned to Agent"
    | "Stub Collected"
    | "With Stock Manager"
    | "Archived";
    currentHolderID?: string;
    agentID?: string;
}

export default ReceiptBook;