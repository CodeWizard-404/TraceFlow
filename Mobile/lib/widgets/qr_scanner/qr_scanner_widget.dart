import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:flutter/services.dart';
import 'package:google_mlkit_barcode_scanning/google_mlkit_barcode_scanning.dart';
import '../../widgets/appbar/app_bar.dart';
import '../../widgets/commen/button.dart';
import '../../widgets/commen/progress_indicator.dart';
import '../../widgets/commen/spacer.dart';
import '../commen/snack_bar.dar.dart';

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
  double _appBarHeight = 0.0;

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
      CustomSnackBar.show(
        context: context,
        message: 'No valid QR code detected',
        backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
      );
    } catch (e) {
      CustomSnackBar.show(
        context: context,
        message: 'Error scanning QR code: $e',
        backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
      );
    } finally {
      setState(() => _isScanning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: Colors.black, // Kept as black for camera overlay
      body: Stack(
        children: [
          // Camera Preview (unchanged for precision)
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
                painter: QROverlayPainter(appBarHeight: _appBarHeight, theme: theme),
              ),
            ),
          // AppBar and content
          Column(
            children: [
              CustomAppBar(
                title: 'QR Scanner',
                showBackButton: true,
                onJumpToNow: null,
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                child: Text(
                  'Align the QR code within the frame',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurface.withOpacity(0.9),
                    fontWeight: FontWeight.w500,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
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
                          CustomProgressIndicator(
                            color: theme.colorScheme.primary,
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
                                      child: _buildStaticCorner(theme),
                                    ),
                                    Positioned(
                                      top: 0,
                                      right: 0,
                                      child: Transform.rotate(
                                        angle: 1.5708,
                                        child: _buildStaticCorner(theme),
                                      ),
                                    ),
                                    Positioned(
                                      bottom: 0,
                                      left: 0,
                                      child: Transform.rotate(
                                        angle: -1.5708,
                                        child: _buildStaticCorner(theme),
                                      ),
                                    ),
                                    Positioned(
                                      bottom: 0,
                                      right: 0,
                                      child: Transform.rotate(
                                        angle: 3.1416,
                                        child: _buildStaticCorner(theme),
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
                                        theme.colorScheme.background.withOpacity(0.6),
                                        theme.colorScheme.background.withOpacity(0.3),
                                      ],
                                    ),
                                  ),
                                  child: CustomProgressIndicator(
                                    color: theme.colorScheme.primary,
                                  ),
                                ),
                            ],
                          ),
                        const CustomSpacer(height: 0),
                        CustomButton(
                          label: _isScanning ? 'Scanning...' : 'Scan QR',
                          icon: Icons.qr_code_scanner,
                          onPressed: _scanQRCode,
                          isLoading: _isScanning,
                          backgroundColor: _isScanning
                              ? theme.colorScheme.secondary.withOpacity(0.6)
                              : theme.colorScheme.primary,
                          textColor: theme.elevatedButtonTheme.style?.foregroundColor?.resolve({}),
                        ),
                        const CustomSpacer(height: 0),
                        Text(
                          _isScanning ? 'Analyzing code...' : 'Tap to initiate scan',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.onSurface.withOpacity(0.8),
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

  Widget _buildStaticCorner(ThemeData theme) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: theme.colorScheme.primary, width: 5),
          left: BorderSide(color: theme.colorScheme.primary, width: 5),
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
  final ThemeData theme;

  QROverlayPainter({required this.appBarHeight, required this.theme});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.black.withOpacity(0.85);

    const qrSize = 313.0;
    final availableHeight = size.height - appBarHeight;
    final qrRect = Rect.fromCenter(
      center: Offset(size.width / 2, size.height / 1.87),
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
          theme.colorScheme.primary.withOpacity(0.1),
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