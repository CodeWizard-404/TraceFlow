const QRCode = require('qrcode');
const { createCanvas, loadImage } = require('canvas');

class QRGenerator {
    static formatTLV(tag, value) {
        const length = value.length.toString().padStart(2, '0');
        return `${tag}${length}${value}`;
    }

    static async generateReceiptBookQR(number, type) {
        const tlvData = [
            this.formatTLV('01', number.toString()),
            this.formatTLV('02', type),
        ].join('');

        const qrCodeDataUrl = await QRCode.toDataURL(tlvData);
        const canvas = createCanvas(190, 240); // Perfect square (rectangle)
        const ctx = canvas.getContext('2d');

        // Set the entire canvas background to pure white
        ctx.fillStyle = '#FFFFFF'; // Pure white background
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Load and draw the QR code image (centered)
        const qrImage = await loadImage(qrCodeDataUrl);
        const qrSize = 200; // QR code size
        const qrX = (canvas.width - qrSize) / 2; // Center horizontally
        const qrY = (canvas.height - qrSize) / 2 + 20; // Center vertically, slightly lower to make room for text
        ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

        // Set font to a digital clock-like style (monospaced)
        ctx.font = '20px "Courier", monospace';
        ctx.fillStyle = '#000000'; // Black text
        ctx.textAlign = 'center';
        ctx.fillText(`#${number}\n${type}`, canvas.width / 2, 30); // Text at the top

        // Return binary buffer
        return canvas.toBuffer('image/png');
    }
}

module.exports = QRGenerator;