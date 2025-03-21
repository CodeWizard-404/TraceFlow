interface Permission {
    permissionID: string;
    name: string;
    type: "page" | "feature";
    class: "User" | "Role" | "Timesheet" | "Visit" | "Checklist" | "Reason" | "ReceiptBook" | "ReceiptStub" | "Agent";
    description?: string;
}

export default Permission;