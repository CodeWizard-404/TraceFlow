// utils/qrParser.js (BACKEND)
function parseTLV(data) {
    let index = 0;
    const result = {};

    while (index < data.length) {
        const tag = data.substr(index, 2);
        index += 2;

        const length = parseInt(data.substr(index, 2), 10);
        index += 2;

        const value = data.substr(index, length);
        index += length;

        // Recursively parse nested TLV structures
        if (value.length >= 4 && !isNaN(parseInt(value.substr(2, 2)))) {
            result[tag] = parseTLV(value);
        } else {
            result[tag] = value;
        }
    }

    return result;
}

module.exports = { parseTLV };