interface ReceiptBookTransfer {
    transferID: string;
    bookID: string;
    fromUserID?: string;
    toUserID?: string;
    status: string;
    transferDate: string;
}

export default ReceiptBookTransfer;