import 'package:flutter/material.dart';
import '../widgets/commen/button.dart';
import '../widgets/Glass_Effect/GlassContainer.dart';
import '../widgets/commen/spacer.dart';

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
  late AnimationController _fadeController;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    )..forward();
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeInOut,
    );
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: GlassContainer(
                width: MediaQuery.of(context).size.width * 0.85,
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // 404 Icon and Text
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                            colors: [
                              theme.colorScheme.primary.withOpacity(0.3),
                              theme.colorScheme.primary.withOpacity(0.1),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        child: Icon(
                          Icons.warning_rounded,
                          size: 60,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                      const CustomSpacer(height: 20),
                      Text(
                        '404',
                        style: TextStyle(
                          fontSize: 64,
                          fontWeight: FontWeight.bold,
                          color: theme.colorScheme.primary,
                          fontFamily: 'Inter',
                          letterSpacing: 2,
                        ),
                      ),
                      Text(
                        'Page Not Found',
                        style: theme.textTheme.headlineSmall?.copyWith(
                          color: theme.colorScheme.onSurface,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const CustomSpacer(height: 16),
                      // Error Message
                      Text(
                        widget.errorMessage,
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurface.withOpacity(0.7),
                        ),
                      ),
                      const CustomSpacer(height: 32),
                      // Buttons
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          if (widget.onRetry != null) ...[
                            CustomButton(
                              label: 'Retry',
                              icon: Icons.refresh,
                              onPressed: widget.onRetry!,
                            ),
                            const CustomSpacer(width: 16),
                          ],
                          CustomButton(
                            label: 'Back Home',
                            icon: Icons.arrow_back,
                            isOutlined: true,
                            onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}