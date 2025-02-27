import 'package:flutter/material.dart';
import 'package:qr_code_scanner/qr_code_scanner.dart';
import 'Reason.dart'; // Import the next page

class QRscan extends StatefulWidget {
  @override
  _QRscanState createState() => _QRscanState();
}

class _QRscanState extends State<QRscan> {
  final GlobalKey qrKey = GlobalKey(debugLabel: 'QR');
  QRViewController? controller;

  @override
  void dispose() {
    controller?.dispose();
    super.dispose();
  }

  void onQRViewCreated(QRViewController controller) {
    this.controller = controller;
    controller.scannedDataStream.listen((scanData) {
      // Simulating a default validation (always true)
      bool isValid = true;

      if (isValid) {
        controller.pauseCamera(); // Stop scanning after a valid QR is found
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => Reason()),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Scan QR Code')),
      body: Column(
        children: [
          Expanded(
            flex: 4,
            child: QRView(
              key: qrKey,
              onQRViewCreated: onQRViewCreated,
            ),
          ),
          Expanded(
            flex: 1,
            child: Center(child: Text('Scan a valid QR code to continue')),
          ),
        ],
      ),
    );
  }
}
