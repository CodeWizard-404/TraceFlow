import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:flutter/services.dart';
import 'package:google_mlkit_barcode_scanning/google_mlkit_barcode_scanning.dart';
import '../../widgets/appbar/app_bar.dart';
import '../commen/progress_indicator.dart';
import '../commen/snack_bar.dar.dart';
import '../commen/spacer.dart';

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
  bool _isSuccess = false;
  bool _isShaking = false;
  String _statusText = 'Scanning for QR code...';
  double _appBarHeight = 0.0;

  @override
  void initState() {
    super.initState();
    _initializeCamera();
  }

  Future<void> _initializeCamera() async {
    final cameras = await availableCameras();
    _cameraController = CameraController(
      cameras.firstWhere((camera) => camera.lensDirection == CameraLensDirection.back),
      ResolutionPreset.high,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.yuv420,
    );
    await _cameraController.initialize();
    await _cameraController.lockCaptureOrientation(DeviceOrientation.portraitUp);

    setState(() {
      _isInitialized = true;
    });
    _startContinuousScan();
  }

  Future<void> _startContinuousScan() async {
    if (!_isInitialized || _isScanning || _isSuccess) return;
    setState(() => _isScanning = true);

    try {
      while (_isInitialized && mounted && !_isSuccess) {
        final image = await _cameraController.takePicture();
        final inputImage = InputImage.fromFilePath(image.path);
        final barcodes = await _barcodeScanner.processImage(inputImage);

        if (barcodes.isNotEmpty && barcodes.first.rawValue != null) {
          setState(() {
            _statusText = 'QR code detected';
          });
          await Future.delayed(const Duration(milliseconds: 1500));
          setState(() {
            _statusText = 'Verifying QR code...';
          });
          await Future.delayed(const Duration(milliseconds: 1500));

          // Return QR data to parent
          setState(() {
            _isSuccess = true;
            _statusText = 'QR code validated!';
          });
          await Future.delayed(const Duration(milliseconds: 1000));
          Navigator.pop(context, barcodes.first.rawValue);
          return;
        }

        await Future.delayed(const Duration(milliseconds: 100)); // Control scan rate
      }
    } catch (e) {
      setState(() {
        _isShaking = true;
        _statusText = 'Error scanning QR code';
      });
      CustomSnackBar.show(
        context: context,
        message: 'Error: $e',
        backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
      );
      await Future.delayed(const Duration(milliseconds: 500));
      setState(() => _isShaking = false);
    } finally {
      setState(() => _isScanning = false);
    }
  }

  @override
  void dispose() {
    _cameraController.dispose();
    _barcodeScanner.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
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
          if (_isInitialized)
            Positioned.fill(
              child: CustomPaint(
                painter: QROverlayPainter(appBarHeight: _appBarHeight, theme: theme),
              ),
            ),
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
                            color: theme.primaryColor,
                          )
                        else
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            curve: Curves.easeInOut,
                            transform: _isShaking
                                ? (Matrix4.identity()..translate(10.0, 0.0))
                                : Matrix4.identity(),
                            child: Stack(
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
                                if (_isScanning && !_isSuccess)
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
                                if (_isSuccess)
                                  Icon(
                                    Icons.check_circle,
                                    color: Colors.green,
                                    size: 80,
                                  ),
                              ],
                            ),
                          ),
                        const CustomSpacer(height: 16),
                        Text(
                          _statusText,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w500,
                          ),
                          textAlign: TextAlign.center,
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
          top: BorderSide(color: Colors.green, width: 5),
          left: BorderSide(color: Colors.green, width: 5),
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
          Colors.green.withOpacity(0.2),
          Colors.transparent,
        ],
      ).createShader(qrRect);

    canvas.drawRRect(
      RRect.fromRectAndRadius(qrRect, const Radius.circular(12)),
      gradientPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}