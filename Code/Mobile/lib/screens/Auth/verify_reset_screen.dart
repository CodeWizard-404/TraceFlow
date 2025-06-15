import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../widgets/commen/title_text.dart';
import 'package:flutter/foundation.dart';

class VerifyResetScreen extends StatefulWidget {
  const VerifyResetScreen({super.key});

  @override
  VerifyResetScreenState createState() => VerifyResetScreenState();
}

class VerifyResetScreenState extends State<VerifyResetScreen> {
  final _formKey = GlobalKey<FormState>();
  final _otpController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  Map<String, String> _errors = {};

  @override
  void dispose() {
    _otpController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  String? _validateOTP(String? value) {
    if (value?.isEmpty ?? true) return 'Please enter the OTP.';
    if (!RegExp(r'^\d{6}$').hasMatch(value!)) return 'OTP must be 6 digits.';
    return null;
  }

  String? _validatePassword(String? value) {
    if (value?.isEmpty ?? true) return 'Please enter a password.';
    if (value!.length < 8) return 'Password must be at least 8 characters.';
    if (!RegExp(r'^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$').hasMatch(value)) {
      return 'Password must contain letters and numbers.';
    }
    return null;
  }

  String? _validateConfirmPassword(String? value) {
    if (value?.isEmpty ?? true) return 'Please confirm your password.';
    if (value != _passwordController.text) return 'Passwords do not match.';
    return null;
  }

  bool _validateForm({bool isPasswordStep = false}) {
    final newErrors = <String, String>{};
    if (!isPasswordStep) {
      newErrors['otp'] = _validateOTP(_otpController.text) ?? '';
    } else {
      newErrors['password'] = _validatePassword(_passwordController.text) ?? '';
      newErrors['confirmPassword'] = _validateConfirmPassword(_confirmPasswordController.text) ?? '';
    }
    setState(() => _errors = newErrors);
    return newErrors.values.every((err) => err.isEmpty);
  }

  Future<void> _verifyOTP() async {
    if (!_validateForm()) return;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.verifyPasswordResetOTP(_otpController.text.trim());
  }

  Future<void> _resetPassword() async {
    if (!_validateForm(isPasswordStep: true)) return;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.resetPassword(_passwordController.text.trim());
    if (authProvider.errorMessage == 'Password reset successfully! Please log in.') {
      if (kDebugMode) print('Navigating to /login after password reset');
      Navigator.pushReplacementNamed(context, '/login');
    }
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

    final isPasswordStep = authProvider.otpVerified;

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
                      CustomTitleText(text: isPasswordStep ? 'Reset Password' : 'Verify OTP'),
                      const SizedBox(height: 8),
                      Text(
                        isPasswordStep
                            ? 'Enter your new password.'
                            : 'Enter the 6-digit code sent to your ${authProvider.otpMethod}.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onBackground.withOpacity(0.6),
                        ),
                      ),
                      const SizedBox(height: 48),
                      if (!isPasswordStep) ...[
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
                        const SizedBox(height: 24),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Resend OTP in ${authProvider.otpTimer.value} seconds',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onBackground.withOpacity(0.6),
                              ),
                            ),
                            if (authProvider.otpTimer.value == 0)
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
                      ] else ...[
                        TextFormField(
                          controller: _passwordController,
                          decoration: InputDecoration(
                            labelText: 'New Password',
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
                            errorText: _errors['password']?.isNotEmpty == true
                                ? _errors['password']
                                : null,
                            errorStyle: TextStyle(color: theme.colorScheme.error),
                          ),
                          enabled: !authProvider.isLoading,
                          onChanged: (_) => _validateForm(isPasswordStep: true),
                          obscureText: true,
                          style: TextStyle(color: theme.colorScheme.onSurface),
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _confirmPasswordController,
                          decoration: InputDecoration(
                            labelText: 'Confirm Password',
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
                            errorText: _errors['confirmPassword']?.isNotEmpty == true
                                ? _errors['confirmPassword']
                                : null,
                            errorStyle: TextStyle(color: theme.colorScheme.error),
                          ),
                          enabled: !authProvider.isLoading,
                          onChanged: (_) => _validateForm(isPasswordStep: true),
                          obscureText: true,
                          style: TextStyle(color: theme.colorScheme.onSurface),
                        ),
                      ],
                      const SizedBox(height: 24),
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: authProvider.isLoading
                              ? null
                              : isPasswordStep
                              ? _resetPassword
                              : _verifyOTP,
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
                            isPasswordStep ? 'Reset Password' : 'Submit OTP',
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