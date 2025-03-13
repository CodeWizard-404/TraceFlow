function generateTLV(receiptBook) {
    let tlvString = "";

    // Tag 01: bookID
    const bookID = receiptBook.bookID || "";
    tlvString += `01${String(bookID.length).padStart(2, "0")}${bookID}`;

    // Tag 02: number (convert to string)
    const number = String(receiptBook.number || "");
    tlvString += `02${String(number.length).padStart(2, "0")}${number}`;

    // Tag 03: type
    const type = receiptBook.type || "";
    tlvString += `03${String(type.length).padStart(2, "0")}${type}`;

    // Tag 04: status
    const status = receiptBook.status || "";
    tlvString += `04${String(status.length).padStart(2, "0")}${status}`;

    return tlvString;
}

// Example usage
const receiptBook = {
    bookID: "book_001",
    number: 1001,
    type: "Payment",
    status: "In Stock"
};
const tlvData = generateTLV(receiptBook);
console.log(tlvData); // "0107book_001020410010307Payment0408In Stock"

// Function to parse TLV data
function parseTLV(tlvString) {
    const result = {};
    let i = 0;
    while (i < tlvString.length) {
        const tag = tlvString.substr(i, 2);
        const length = parseInt(tlvString.substr(i + 2, 2), 10);
        const value = tlvString.substr(i + 4, length);
        result[tag] = value;
        i += 4 + length;
    }
    return result;
}

// Verify with parseTLV
const parsed = parseTLV(tlvData);
console.log(parsed);
/* Output:
{
    "01": "book_001",
    "02": "1001",
    "03": "Payment",
    "04": "In Stock"
}
*/