import ReceiptBookStatus from "./Enum/ReceiptBookStatus";
import ReceiptStub from "./ReceiptStub";

interface ReceiptBook {
    bookID: string;
    number: string;
    type: string;
    qrCode: string;
    status: ReceiptBookStatus
    currentHolderID?: string;
    agentID?: string;
    ReceiptStub?: ReceiptStub;
}

export default ReceiptBook;