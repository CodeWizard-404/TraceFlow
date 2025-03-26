import ReceiptBookStatus from "./Enum/ReceiptBookStatus";

interface ReceiptBook {
    bookID: string;
    number: string;
    type: string;
    qrCode: string;
    status: ReceiptBookStatus
    currentHolderID?: string;
    agentID?: string;
}

export default ReceiptBook;