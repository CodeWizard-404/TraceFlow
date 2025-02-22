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
    if (!_isInitialized) return const Center(child: CircularProgressIndicator());
    final cameraAspectRatio = _cameraController.value.aspectRatio;
    final rotationAngle = _getRotationAngle(MediaQuery.of(context).orientation);
    // Get the screen size
    final screenSize = MediaQuery.of(context).size;

    return Scaffold(
      appBar: AppBar(title: const Text('Scan QR Code')),
      body: Stack(
        children: [
          // Full-screen camera preview
          Positioned.fill(
            child: FittedBox(
              fit: BoxFit.cover, // Ensures the preview fills the screen
              child: SizedBox(
                width: screenSize.width,
                height: screenSize.width / _cameraController.value.aspectRatio,
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


          // Tap-to-scan overlay
          Positioned.fill(
            child: GestureDetector(
              onTap: () async {
                final image = await _cameraController.takePicture();
                final inputImage = InputImage.fromFilePath(image.path);
                final barcodes = await _barcodeScanner.processImage(inputImage);
                for (final barcode in barcodes) {
                  if (barcode.rawValue != null) Navigator.pop(context, barcode.rawValue);
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