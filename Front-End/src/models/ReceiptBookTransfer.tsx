interface ReceiptBookTransfer {
    transferID: string;
    bookID: string;
    fromUserID?: string;
    toUserID?: string;
    toAgentID?: string;
    status: "Pending" | "Validated";
    transferType:
    | "ToSupplier"
    | "ToRegionalManager"
    | "ToSupervisor"
    | "ToAgent"
    | "StubToSupervisor"
    | "ToRegionalManagerFromSupervisor"
    | "ToStockManager"
    | "Archived"
    | "FromSupplier"; 
    transferDate: string;
}

export default ReceiptBookTransfer;