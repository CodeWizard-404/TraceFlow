interface ReceiptBook {
    bookID: string;
    number: number;
    type: string;
    qrCode: string; // Base64 encoded QR code image
    status: "In Stock" | "Sent to Supplier" | "With Regional Manager" | "With Supervisor" | "Assigned to Agent" | "Stub Collected" | "With Stock Manager";
    currentHolderID?: string; // User ID of current holder
    agentID?: string; // Optional agent assignment
    createdAt?: string;
    updatedAt?: string;
}

export default ReceiptBook;