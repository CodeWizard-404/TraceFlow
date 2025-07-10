import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../widgets/commen/title_text.dart';
import 'package:flutter/foundation.dart';

class Verify2FAScreen extends StatefulWidget {
  const Verify2FAScreen({super.key});

  @override
  Verify2FAScreenState createState() => Verify2FAScreenState();
}

class Verify2FAScreenState extends State<Verify2FAScreen> {
  final _formKey = GlobalKey<FormState>();
  final _otpController = TextEditingController();
  bool _trustDevice = false;
  Map<String, String> _errors = {};

  @override
  void initState() {
    super.initState();
    // Ensure timers are running when screen mounts
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (authProvider.otpTimer.value == 600) {
        if (kDebugMode) print('Starting OTP and resend timers on Verify2FAScreen init');
        authProvider.startOtpTimer();
        authProvider.startResendTimer();
      }
    });
  }

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  String? _validateOTP(String? value) {
    if (value?.isEmpty ?? true) return 'Please enter the OTP.';
    if (!RegExp(r'^\d{6}$').hasMatch(value!)) return 'OTP must be 6 digits.';
    return null;
  }

  bool _validateForm() {
    final newErrors = <String, String>{};
    newErrors['otp'] = _validateOTP(_otpController.text) ?? '';
    setState(() => _errors = newErrors);
    return newErrors.values.every((err) => err.isEmpty);
  }

  Future<void> _verify2FA() async {
    if (!_validateForm()) return;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.verify2FA(_otpController.text.trim(), _trustDevice);
    if (authProvider.isAuthenticated) {
      if (kDebugMode) print('Navigating to /dashboard after 2FA verification');
      Navigator.pushReplacementNamed(context, '/dashboard');
    }
  }

  // Format seconds into MM:SS
  String _formatTimer(int seconds) {
    final minutes = (seconds ~/ 60).toString().padLeft(2, '0');
    final secs = (seconds % 60).toString().padLeft(2, '0');
    if (kDebugMode && seconds % 60 == 0) {
      print('Timer updated: $minutes:$secs');
    }
    return '$minutes:$secs';
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final themeProvider = Provider.of<ThemeProvider>(context);
    final theme = themeProvider.currentTheme;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (authProvider.errorMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(authProvider.errorMessage!),
            backgroundColor: authProvider.errorMessage!.contains('success')
                ? theme.colorScheme.primary
                : theme.colorScheme.error,
            duration: const Duration(seconds: 5),
          ),
        );
        authProvider.clearError();
      }
    });

    return Scaffold(
      backgroundColor: theme.colorScheme.background,
      body: Stack(
        children: [
          _buildBackgroundOverlay(context),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const CustomTitleText(text: 'Verify 2FA'),
                      const SizedBox(height: 8),
                      Text(
                        'Enter the 6-digit code sent to your ${authProvider.otpMethod}.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onBackground.withOpacity(0.6),
                        ),
                      ),
                      const SizedBox(height: 48),
                      TextFormField(
                        controller: _otpController,
                        decoration: InputDecoration(
                          labelText: 'OTP',
                          labelStyle: TextStyle(color: theme.colorScheme.onSurfaceVariant),
                          prefixIcon: Icon(Icons.lock, color: theme.colorScheme.primary),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: theme.colorScheme.outline),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: theme.colorScheme.outline),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: theme.colorScheme.primary, width: 2),
                          ),
                          errorText: _errors['otp']?.isNotEmpty == true ? _errors['otp'] : null,
                          errorStyle: TextStyle(color: theme.colorScheme.error),
                        ),
                        enabled: !authProvider.isLoading,
                        onChanged: (_) => _validateForm(),
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        style: TextStyle(color: theme.colorScheme.onSurface),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Checkbox(
                            value: _trustDevice,
                            onChanged: authProvider.isLoading
                                ? null
                                : (value) => setState(() => _trustDevice = value ?? false),
                            activeColor: theme.colorScheme.primary,
                          ),
                          Text(
                            'Trust this device',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onBackground,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ValueListenableBuilder<int>(
                            valueListenable: authProvider.otpTimer,
                            builder: (context, value, child) => Text(
                              'Remaining time: ${_formatTimer(value)}',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onBackground.withOpacity(0.6),
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              ValueListenableBuilder<int>(
                                valueListenable: authProvider.resendTimer,
                                builder: (context, value, child) => Text(
                                  'Resend available in ${_formatTimer(value)}',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.colorScheme.onBackground.withOpacity(0.6),
                                  ),
                                ),
                              ),
                              if (authProvider.resendTimer.value == 0)
                                TextButton(
                                  onPressed: authProvider.isLoading
                                      ? null
                                      : () => authProvider.resend2FA(authProvider.otpMethod),
                                  child: Text(
                                    'Resend',
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: theme.colorScheme.primary,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: authProvider.isLoading ? null : _verify2FA,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: theme.colorScheme.primary,
                            foregroundColor: theme.colorScheme.onPrimary,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                            elevation: 2,
                          ),
                          child: authProvider.isLoading
                              ? SpinKitFadingCircle(
                            color: theme.colorScheme.onPrimary,
                            size: 24,
                          )
                              : Text(
                            'Submit OTP',
                            style: theme.textTheme.labelLarge?.copyWith(
                              color: theme.colorScheme.onPrimary,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextButton(
                        onPressed: () => Navigator.pushReplacementNamed(context, '/login'),
                        child: Text(
                          'Back to Sign In',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 16,
            left: 16,
            child: Consumer<ThemeProvider>(
              builder: (context, themeProvider, _) => _buildIconButton(
                context,
                icon: _getThemeIcon(themeProvider.themeMode),
                tooltip: 'Toggle Theme',
                onTap: () {
                  final nextMode = _getNextThemeMode(themeProvider.themeMode);
                  themeProvider.setTheme(nextMode);
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBackgroundOverlay(BuildContext context) {
    final theme = Provider.of<ThemeProvider>(context).currentTheme;
    return Stack(
      children: [
        Container(
          color: theme.colorScheme.background.withOpacity(0.9),
        ),
        Positioned(
          top: 50,
          left: 20,
          child: Icon(
            Icons.location_pin,
            size: 40,
            color: theme.colorScheme.primary.withOpacity(0.2),
          ),
        ),
        Positioned(
          bottom: 100,
          right: 30,
          child: Icon(
            Icons.access_time,
            size: 50,
            color: theme.colorScheme.secondary.withOpacity(0.2),
          ),
        ),
        Positioned(
          top: 200,
          right: 50,
          child: Icon(
            Icons.qr_code,
            size: 45,
            color: theme.colorScheme.tertiary.withOpacity(0.2),
          ),
        ),
        Positioned(
          top: 100,
          left: 100,
          child: AnimatedContainer(
            duration: const Duration(seconds: 3),
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: theme.colorScheme.primary.withOpacity(0.3),
              shape: BoxShape.circle,
            ),
          ),
        ),
        Positioned(
          bottom: 150,
          left: 50,
          child: AnimatedContainer(
            duration: const Duration(seconds: 4),
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              color: theme.colorScheme.secondary.withOpacity(0.3),
              shape: BoxShape.circle,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildIconButton(
      BuildContext context, {
        required IconData icon,
        required String tooltip,
        VoidCallback? onTap,
        Color? color,
      }) {
    final theme = Theme.of(context);
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        splashColor: (color ?? theme.colorScheme.primary).withOpacity(0.2),
        highlightColor: (color ?? theme.colorScheme.primary).withOpacity(0.1),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Icon(
            icon,
            color: color ?? theme.colorScheme.primary,
            size: 18,
          ),
        ),
      ),
    );
  }

  IconData _getThemeIcon(ThemeMode mode) {
    switch (mode) {
      case ThemeMode.system:
        return Icons.hdr_auto;
      case ThemeMode.light:
        return Icons.light_mode_rounded;
      case ThemeMode.dark:
        return Icons.brightness_2;
    }
  }

  ThemeMode _getNextThemeMode(ThemeMode current) {
    switch (current) {
      case ThemeMode.system:
        return ThemeMode.light;
      case ThemeMode.light:
        return ThemeMode.dark;
      case ThemeMode.dark:
        return ThemeMode.system;
    }
  }
}