import ReceiptStubStatus from "./Enum/ReceiptStubStatus";

interface ReceiptStub {
    stubID: string;
    bookID: string;
    status: ReceiptStubStatus
}

export default ReceiptStub;