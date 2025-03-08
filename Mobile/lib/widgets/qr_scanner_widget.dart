import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:flutter/services.dart';
import 'package:google_mlkit_barcode_scanning/google_mlkit_barcode_scanning.dart';

class QRScannerWidget extends StatefulWidget {
  const QRScannerWidget({super.key});

  @override
  QRScannerWidgetState createState() => QRScannerWidgetState();
}

class QRScannerWidgetState extends State<QRScannerWidget> {
  late CameraController _cameraController;
  final BarcodeScanner _barcodeScanner = BarcodeScanner(formats: [BarcodeFormat.qrCode]);
  bool _isInitialized = false;
  bool _isScanning = false;
  double _appBarHeight = 0.0; // To store the app bar height for alignment

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

    setState(() {
      _isInitialized = true;
    });
  }

  @override
  void dispose() {
    _cameraController.dispose();
    _barcodeScanner.close();
    super.dispose();
  }

  Future<void> _scanQRCode() async {
    if (!_isInitialized || _isScanning) return;
    setState(() => _isScanning = true);
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
      _showSnackBar('No valid QR code detected');
    } catch (e) {
      _showSnackBar('Error scanning QR code: $e');
    } finally {
      setState(() => _isScanning = false);
    }
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red.withOpacity(0.9),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Camera Preview
          if (_isInitialized)
            Positioned.fill(
              child: OverflowBox(
                maxWidth: double.infinity,
                maxHeight: double.infinity,
                child: FittedBox(
                  fit: BoxFit.cover,
                  child: SizedBox(
                    width: _cameraController.value.previewSize?.height,
                    height: _cameraController.value.previewSize?.width,
                    child: CameraPreview(_cameraController),
                  ),
                ),
              ),
            ),
          // Dark overlay outside QR frame
          if (_isInitialized)
            Positioned.fill(
              child: CustomPaint(
                painter: QROverlayPainter(appBarHeight: _appBarHeight),
              ),
            ),
          // AppBar and content
          Column(
            children: [
              Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF4CB1C7), Color(0xFF64C9D1)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(30),
                    bottomRight: Radius.circular(30),
                  ),
                ),
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.arrow_back_ios_rounded, color: Colors.white),
                              onPressed: () => Navigator.of(context).pop(),
                            ),
                          ],
                        ),
                        const Text(
                          'QR Scanner',
                          style: TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 1.2,
                            shadows: [Shadow(color: Colors.black45, blurRadius: 4, offset: Offset(0, 2))],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Align the QR code within the frame',
                          style: TextStyle(
                            fontSize: 16,
                            color: Colors.white.withOpacity(0.9),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],
                    ),
                  ),
                ),
              ),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    // Calculate app bar height after layout
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      final appBarRenderBox = context.findRenderObject() as RenderBox?;
                      if (appBarRenderBox != null && _appBarHeight != appBarRenderBox.size.height) {
                        setState(() {
                          _appBarHeight = appBarRenderBox.size.height + MediaQuery.of(context).padding.top;
                        });
                      }
                    });

                    return Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (!_isInitialized)
                          const CircularProgressIndicator(
                            color: Color(0xFF4CB1C7),
                            strokeWidth: 3,
                          )
                        else
                          Stack(
                            alignment: Alignment.center,
                            children: [
                              SizedBox(
                                width: 320,
                                height: 320,
                                child: Stack(
                                  children: [
                                    Positioned(
                                      top: 0,
                                      left: 0,
                                      child: _buildStaticCorner(),
                                    ),
                                    Positioned(
                                      top: 0,
                                      right: 0,
                                      child: Transform.rotate(
                                        angle: 1.5708,
                                        child: _buildStaticCorner(),
                                      ),
                                    ),
                                    Positioned(
                                      bottom: 0,
                                      left: 0,
                                      child: Transform.rotate(
                                        angle: -1.5708,
                                        child: _buildStaticCorner(),
                                      ),
                                    ),
                                    Positioned(
                                      bottom: 0,
                                      right: 0,
                                      child: Transform.rotate(
                                        angle: 3.1416,
                                        child: _buildStaticCorner(),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (_isScanning)
                                Container(
                                  width: 70,
                                  height: 70,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    gradient: RadialGradient(
                                      colors: [
                                        Colors.black.withOpacity(0.6),
                                        Colors.black.withOpacity(0.3),
                                      ],
                                    ),
                                  ),
                                  child: const CircularProgressIndicator(
                                    color: Color(0xFF4CB1C7),
                                    strokeWidth: 4,
                                  ),
                                ),
                            ],
                          ),
                        const SizedBox(height: 48),
                        GestureDetector(
                          onTap: _scanQRCode,
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            curve: Curves.easeInOut,
                            padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 18),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: _isScanning
                                    ? [Colors.grey.shade600, Colors.grey.shade700]
                                    : [const Color(0xFF4CB1C7), const Color(0xFF64C9D1)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(40),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.qr_code_scanner,
                                  color: Colors.white.withOpacity(_isScanning ? 0.7 : 1.0),
                                  size: 28,
                                ),
                                const SizedBox(width: 16),
                                Text(
                                  _isScanning ? 'Scanning...' : 'Scan QR',
                                  style: TextStyle(
                                    fontSize: 20,
                                    color: Colors.white.withOpacity(_isScanning ? 0.7 : 1.0),
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 1.1,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),
                        Text(
                          _isScanning ? 'Analyzing code...' : 'Tap to initiate scan',
                          style: TextStyle(
                            fontSize: 16,
                            color: Colors.white.withOpacity(0.8),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStaticCorner() {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: const Color(0xFF4CB1C7), width: 5),
          left: BorderSide(color: const Color(0xFF4CB1C7), width: 5),
        ),
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(12),
        ),
      ),
    );
  }
}

class QROverlayPainter extends CustomPainter {
  final double appBarHeight;

  QROverlayPainter({required this.appBarHeight});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.black.withOpacity(0.85);

    const qrSize = 320.0;
    // Center the frame in the space below the app bar
    final availableHeight = size.height - appBarHeight;
    final qrRect = Rect.fromCenter(
      center: Offset(
        size.width / 2,
        appBarHeight + (availableHeight - 48 - 24 - 72) / 2, // Adjust for button and text below
      ),
      width: qrSize,
      height: qrSize,
    );

    final path = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addRRect(
        RRect.fromRectAndRadius(
          qrRect,
          const Radius.circular(12),
        ),
      )
      ..fillType = PathFillType.evenOdd;

    canvas.drawPath(path, paint);

    final gradientPaint = Paint()
      ..shader = RadialGradient(
        center: Alignment.center,
        radius: qrSize / 2 + 20,
        colors: [
          const Color(0xFF4CB1C7).withOpacity(0.1),
          Colors.transparent,
        ],
      ).createShader(qrRect);

    canvas.drawRRect(
      RRect.fromRectAndRadius(qrRect, const Radius.circular(12)),
      gradientPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}