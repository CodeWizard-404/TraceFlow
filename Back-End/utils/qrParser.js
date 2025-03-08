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

        // Check if the value could be a nested TLV
        if (value.length >= 4) {
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