import ReceiptBookStatus from "./Enum/ReceiptBookStatus";
import ReceiptStub from "./ReceiptStub";

interface ReceiptBook {
    bookID: string;
    number: string;
    typeID: string;
    qrCode: string;
    status: ReceiptBookStatus;
    holder?: {
        userID: string;
        firstname: string;
        lastname: string;
        phone: string;
    };
    agentID?: string;
    ReceiptStub?: ReceiptStub;
    currentHolderID?: string;
}

export default ReceiptBook;