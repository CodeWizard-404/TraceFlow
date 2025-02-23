import 'dart:io';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:flutter/services.dart';
import 'package:google_mlkit_barcode_scanning/google_mlkit_barcode_scanning.dart';

class QRScannerWidget extends StatefulWidget {
  const QRScannerWidget({super.key});

  @override
  _QRScannerWidgetState createState() => _QRScannerWidgetState();
}

class _QRScannerWidgetState extends State<QRScannerWidget> {
  late CameraController _cameraController;
  final BarcodeScanner _barcodeScanner = BarcodeScanner(formats: [BarcodeFormat.qrCode]);
  bool _isInitialized = false;

  @override
  void initState() {
    super.initState();
    _initializeCamera();
  }

  Future<void> _initializeCamera() async {
    final cameras = await availableCameras();
    _cameraController = CameraController(
      cameras.first,
      ResolutionPreset.high,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.yuv420,
    );
    await _cameraController.initialize();
    await _cameraController.lockCaptureOrientation(DeviceOrientation.portraitUp);
    setState(() => _isInitialized = true);
  }

  @override
  void dispose() {
    _cameraController.dispose();
    _barcodeScanner.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized) {
      return Scaffold(
        appBar: AppBar(
          title: Text('Scan QR Code'),
          backgroundColor: Color(0xFF4CB1C7),
        ),
        body: Center(child: CircularProgressIndicator(color: Color(0xFF4CB1C7))),
      );
    }

    final cameraAspectRatio = _cameraController.value.aspectRatio;
    final screenSize = MediaQuery.of(context).size;
    final rotationAngle = _getRotationAngle(MediaQuery.of(context).orientation);

    return Scaffold(
      appBar: PreferredSize(
        preferredSize: Size.fromHeight(80),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF4CB1C7), Color(0xFF64C9D1)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
          ),
          child: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            title: Text(
              'Scan QR Code',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            centerTitle: true,
          ),
        ),
      ),
      body: Stack(
        children: [
          // Full-screen camera preview with rotation
          Positioned.fill(
            child: FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(
                width: screenSize.width,
                height: screenSize.width / cameraAspectRatio,
                child: Transform.rotate(
                  angle: rotationAngle,
                  child: AspectRatio(
                    aspectRatio: cameraAspectRatio,
                    child: CameraPreview(_cameraController),
                  ),
                ),
              ),
            ),
          ),

          // Custom overlay
          Positioned.fill(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Expanded(
                  child: Center(
                    child: Container(
                      width: 250,
                      height: 250,
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.white, width: 2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: AnimatedContainer(
                        duration: Duration(milliseconds: 500),
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.green, width: 4),
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ),
                SizedBox(height: 20),
                Text(
                  'Align the QR code within the frame',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: Colors.white),
                ),
                SizedBox(height: 20),
              ],
            ),
          ),

          // Tap-to-scan overlay
          Positioned.fill(
            child: GestureDetector(
              onTap: () async {
                try {
                  final image = await _cameraController.takePicture();
                  final inputImage = InputImage.fromFilePath(image.path);
                  final barcodes = await _barcodeScanner.processImage(inputImage);
                  for (final barcode in barcodes) {
                    if (barcode.rawValue != null) {
                      Navigator.pop(context, barcode.rawValue);
                      return;
                    }
                  }
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('No valid QR code found')),
                  );
                } catch (e) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed to scan QR code: $e')),
                  );
                }
              },
            ),
          ),
        ],
      ),
    );
  }

  // Helper method to calculate the rotation angle
  double _getRotationAngle(Orientation orientation) {
    final sensorOrientation = _cameraController.description.sensorOrientation;
    if (sensorOrientation == 90) {
      // Most devices have a sensor orientation of 90 degrees
      return orientation == Orientation.portrait ? 90 * (3.141592653589793 / 180) : 0;
    } else {
      // Handle other sensor orientations if needed
      return 0;
    }
  }
}