import 'package:flutter/material.dart';
import 'dart:math' as math;

class ErrorPage extends StatefulWidget {
  final String errorMessage;
  final VoidCallback? onRetry;

  const ErrorPage({
    required this.errorMessage,
    this.onRetry,
    super.key,
  });

  @override
  _ErrorPageState createState() => _ErrorPageState();
}

class _ErrorPageState extends State<ErrorPage> with TickerProviderStateMixin {
  late AnimationController _rocketController;
  late AnimationController _glitchController;
  late Animation<double> _rocketAnimation;

  @override
  void initState() {
    super.initState();
    // Rocket floating animation
    _rocketController = AnimationController(
      duration: const Duration(seconds: 4),
      vsync: this,
    )..repeat(reverse: true);
    _rocketAnimation = Tween<double>(begin: 0, end: -20).animate(
      CurvedAnimation(parent: _rocketController, curve: Curves.easeInOut),
    );

    // Glitch animation
    _glitchController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _rocketController.dispose();
    _glitchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Cosmic Background with Stars
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF1E2A44), Color(0xFF0D1B2A)],
              ),
            ),
            child: CustomPaint(
              painter: StarsPainter(),
              child: const SizedBox.expand(),
            ),
          ),
          // Main Content
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Rocket with Trail
                AnimatedBuilder(
                  animation: _rocketAnimation,
                  builder: (context, child) {
                    return Stack(
                      alignment: Alignment.center,
                      children: [
                        // Rocket Trail
                        Container(
                          width: 2,
                          height: 50,
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [Color(0xFF4CB1C7), Colors.transparent],
                            ),
                          ),
                        ),
                        // Rocket Icon
                        Transform.translate(
                          offset: Offset(0, _rocketAnimation.value),
                          child: Transform.rotate(
                            angle: math.pi / 4, // 45 degrees
                            child: const Icon(
                              Icons.rocket_launch,
                              size: 80,
                              color: Color(0xFF4CB1C7),
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 20),
                // 404 Glitch Text
                AnimatedBuilder(
                  animation: _glitchController,
                  builder: (context, child) {
                    return Stack(
                      alignment: Alignment.center,
                      children: [
                        Text(
                          '404',
                          style: TextStyle(
                            fontSize: 100,
                            fontWeight: FontWeight.bold,
                            color: Colors.white.withOpacity(0.8),
                          ),
                        ),
                        Transform.translate(
                          offset: Offset(
                            math.sin(_glitchController.value * 2 * math.pi) * 4,
                            0,
                          ),
                          child: ClipRect(
                            child: Align(
                              alignment: Alignment.topCenter,
                              heightFactor: 0.33,
                              child: Text(
                                '404',
                                style: const TextStyle(
                                  fontSize: 100,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF4CB1C7),
                                ),
                              ),
                            ),
                          ),
                        ),
                        Transform.translate(
                          offset: Offset(
                            math.cos(_glitchController.value * 1.5 * math.pi) * 4,
                            0,
                          ),
                          child: ClipRect(
                            child: Align(
                              alignment: Alignment.bottomCenter,
                              heightFactor: 0.33,
                              child: Text(
                                '404',
                                style: const TextStyle(
                                  fontSize: 100,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFFE81F76),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
                const Text(
                  'Lost in Space',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w400,
                    color: Colors.white70,
                  ),
                ),
                const SizedBox(height: 20),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0),
                  child: Text(
                    widget.errorMessage,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 18,
                      color: Colors.white70,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(height: 30),
                // Buttons
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (widget.onRetry != null)
                      ElevatedButton.icon(
                        onPressed: widget.onRetry,
                        icon: const Icon(Icons.refresh, color: Colors.white),
                        label: const Text('Retry'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF4CB1C7),
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                          elevation: 5,
                        ),
                      ),
                    if (widget.onRetry != null) const SizedBox(width: 16),
                    OutlinedButton.icon(
                      onPressed: () {
                        Navigator.of(context).popUntil((route) => route.isFirst);
                      },
                      icon: const Icon(Icons.arrow_back, color: Color(0xFF4CB1C7)),
                      label: const Text('Return to Orbit'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF4CB1C7),
                        side: const BorderSide(color: Color(0xFF4CB1C7), width: 2),
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Cosmic Waves
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: CustomPaint(
              painter: CosmicWavesPainter(),
              child: const SizedBox(height: 200),
            ),
          ),
        ],
      ),
    );
  }
}

// Stars Painter
class StarsPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final random = math.Random();
    final paint = Paint()..color = Colors.white;

    for (int i = 0; i < 100; i++) {
      final x = random.nextDouble() * size.width;
      final y = random.nextDouble() * size.height;
      final radius = random.nextDouble() * 3 + 1;
      canvas.drawCircle(Offset(x, y), radius, paint..color = Colors.white.withOpacity(random.nextDouble()));
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

// Cosmic Waves Painter
class CosmicWavesPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;

    // Wave 1
    final path1 = Path()
      ..moveTo(0, size.height)
      ..quadraticBezierTo(size.width * 0.25, size.height * 0.7, size.width * 0.5, size.height)
      ..quadraticBezierTo(size.width * 0.75, size.height * 1.3, size.width, size.height)
      ..lineTo(size.width, 0)
      ..lineTo(0, 0)
      ..close();
    canvas.drawPath(path1, paint..color = const Color(0xFF4CB1C7).withOpacity(0.1));

    // Wave 2
    final path2 = Path()
      ..moveTo(0, size.height)
      ..quadraticBezierTo(size.width * 0.3, size.height * 0.6, size.width * 0.6, size.height)
      ..quadraticBezierTo(size.width * 0.9, size.height * 1.2, size.width, size.height)
      ..lineTo(size.width, 0)
      ..lineTo(0, 0)
      ..close();
    canvas.drawPath(path2, paint..color = const Color(0xFFE81F76).withOpacity(0.1));

    // Wave 3
    final path3 = Path()
      ..moveTo(0, size.height)
      ..quadraticBezierTo(size.width * 0.2, size.height * 0.8, size.width * 0.4, size.height)
      ..quadraticBezierTo(size.width * 0.7, size.height * 1.1, size.width, size.height)
      ..lineTo(size.width, 0)
      ..lineTo(0, 0)
      ..close();
    canvas.drawPath(path3, paint..color = const Color(0xFFF59E0B).withOpacity(0.1));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}