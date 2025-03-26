import ReceiptBookTransferStatus from "./Enum/ReceiptBookTransferStatus";
import ReceiptBookTransferType from "./Enum/ReceiptBookTransferType";

interface ReceiptBookTransfer {
    transferID: string;
    bookID: string;
    fromUserID?: string;
    toUserID?: string;
    toAgentID?: string;
    status: ReceiptBookTransferStatus
    transferType: ReceiptBookTransferType
    transferDate: string;
}

export default ReceiptBookTransfer;