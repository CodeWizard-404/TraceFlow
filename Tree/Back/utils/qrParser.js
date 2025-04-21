function parseTLV(data) {
    let index = 0;
    const result = {};

    while (index < data.length) {
        const tag = data.substr(index, 2);
        index += 2;

        const lengthStr = data.substr(index, 2);
        const length = parseInt(lengthStr, 10);
        index += 2;

        const value = data.substr(index, length);
        index += length;

        // Special handling for known phone number tags ("03" or "02")
        if (tag === "03" || tag === "02") {
            result[tag] = value; // Treat as flat string, regardless of content
        }
        // Only parse as nested TLV if it strictly follows TLV format and isn't a phone number
        else if (value.length >= 4 && /^[0-9]{2}[0-9]{2}/.test(value)) {
            const subLengthStr = value.substr(2, 2);
            const subLength = parseInt(subLengthStr, 10);
            if (!isNaN(subLength) && subLength <= value.length - 4) {
                result[tag] = parseTLV(value);
            } else {
                result[tag] = value;
            }
        } else {
            result[tag] = value;
        }
    }

    return result;
}

module.exports = { parseTLV };