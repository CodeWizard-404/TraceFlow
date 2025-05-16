import ReceiptStubtatus from "./Enum/ReceiptStubStatus";

interface ReceiptStub {
    stubID: string;
    bookID: string;
    status: ReceiptStubtatus
}

export default ReceiptStub;