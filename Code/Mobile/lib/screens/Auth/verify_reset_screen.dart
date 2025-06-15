import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../widgets/commen/title_text.dart';

class VerifyResetScreen extends StatefulWidget {
  const VerifyResetScreen({super.key});

  @override
  VerifyResetScreenState createState() => VerifyResetScreenState();
}

class VerifyResetScreenState extends State<VerifyResetScreen> {
  final _formKey = GlobalKey<FormState>();
  final _otpController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _otpFocusNode = FocusNode();
  final _newPasswordFocusNode = FocusNode();
  final _confirmPasswordFocusNode = FocusNode();
  bool _obscureNewPassword = true;
  bool _obscureConfirmPassword = true;
  bool _showResetFields = false;
  Map<String, String> _errors = {};
  String? _successMessage;
  bool _hasNavigated = false;
  DateTime _lastNavigation = DateTime.now();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_showResetFields) {
        _otpFocusNode.requestFocus();
      }
    });
  }

  @override
  void dispose() {
    _otpController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    _otpFocusNode.dispose();
    _newPasswordFocusNode.dispose();
    _confirmPasswordFocusNode.dispose();
    super.dispose();
  }

  String? _validateOTP(String? value) {
    if (value?.isEmpty ?? true) return 'Please enter the 6-digit OTP.';
    if (!RegExp(r'^\d{6}$').hasMatch(value!)) return 'OTP must be exactly 6 digits.';
    return null;
  }

  String? _validateNewPassword(String? value) {
    if (value?.isEmpty ?? true) return 'Please enter a password.';
    if (value!.length < 8) return 'Password must be at least 8 characters long.';
    return null;
  }

  String? _validateConfirmPassword(String? value) {
    if (value?.isEmpty ?? true) return 'Please confirm your password.';
    if (value != _newPasswordController.text) return 'Passwords do not match.';
    return null;
  }

  bool _validateForm() {
    final newErrors = {
      if (!_showResetFields) 'otpCode': _validateOTP(_otpController.text) ?? '',
      if (_showResetFields) 'newPassword': _validateNewPassword(_newPasswordController.text) ?? '',
      if (_showResetFields) 'confirmPassword': _validateConfirmPassword(_confirmPasswordController.text) ?? '',
    };
    setState(() => _errors = newErrors);
    return newErrors.values.every((err) => err.isEmpty);
  }

  Future<void> _verifyResetOTP() async {
    if (!_validateForm()) return;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.verifyPasswordResetOTP(_otpController.text.trim());
    if (authProvider.errorMessage == null) {
      setState(() {
        _showResetFields = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _newPasswordFocusNode.requestFocus();
        });
      });
    }
  }

  Future<void> _resetPassword() async {
    if (!_validateForm()) return;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.resetPassword(_newPasswordController.text.trim());
    if (authProvider.errorMessage == null) {
      setState(() => _successMessage = 'Password reset successfully.');
    }
  }

  Future<void> _resendOTP(String method) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.resend2FA(method);
    if (authProvider.errorMessage == null) {
      setState(() {
        _successMessage = 'OTP resent successfully.';
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _otpFocusNode.requestFocus();
        });
      });
    }
  }

  void _handleNavigation(BuildContext context) {
    final now = DateTime.now();
    if (_hasNavigated || now.difference(_lastNavigation).inMilliseconds < 1000) return;
    _hasNavigated = true;
    _lastNavigation = now;
    Navigator.pushReplacementNamed(context, '/login');
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final themeProvider = Provider.of<ThemeProvider>(context);
    final theme = themeProvider.currentTheme;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (authProvider.errorMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(authProvider.errorMessage!),
            backgroundColor: theme.colorScheme.error,
            duration: const Duration(seconds: 5),
          ),
        );
        authProvider.clearError();
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            if (_showResetFields) {
              _newPasswordFocusNode.requestFocus();
            } else {
              _otpFocusNode.requestFocus();
            }
          }
        });
      } else if (_successMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_successMessage!),
            backgroundColor: theme.colorScheme.primary,
            duration: const Duration(seconds: 5),
          ),
        );
        if (_successMessage!.contains('Password reset successfully')) {
          Future.delayed(const Duration(seconds: 2), () {
            if (mounted) _handleNavigation(context);
          });
        }
        setState(() => _successMessage = null);
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
                      const CustomTitleText(text: 'Reset Password'),
                      const SizedBox(height: 8),
                      Text(
                        'Enter the code sent to your ${authProvider.otpMethod}.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onBackground.withOpacity(0.6),
                        ),
                      ),
                      const SizedBox(height: 48),
                      if (!_showResetFields) ...[
                        TextFormField(
                          controller: _otpController,
                          focusNode: _otpFocusNode,
                          decoration: InputDecoration(
                            labelText: 'Enter Reset OTP',
                            labelStyle: TextStyle(color: theme.colorScheme.onSurfaceVariant),
                            prefixIcon: Icon(Icons.security, color: theme.colorScheme.primary),
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
                            errorText: _errors['otpCode']?.isNotEmpty == true ? _errors['otpCode'] : null,
                            errorStyle: TextStyle(color: theme.colorScheme.error),
                          ),
                          enabled: !authProvider.isLoading,
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                          onChanged: (_) => _validateForm(),
                          style: TextStyle(color: theme.colorScheme.onSurface),
                        ),
                        const SizedBox(height: 16),
                        ValueListenableBuilder<int>(
                          valueListenable: authProvider.otpTimer,
                          builder: (_, otpTimer, __) => Text(
                            'Time remaining: ${(otpTimer ~/ 60).toString().padLeft(2, '0')}:${(otpTimer % 60).toString().padLeft(2, '0')}',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        const SizedBox(height: 24),
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: authProvider.isLoading ? null : _verifyResetOTP,
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
                              'Verify OTP',
                              style: theme.textTheme.labelLarge?.copyWith(
                                color: theme.colorScheme.onPrimary,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        ValueListenableBuilder<int>(
                          valueListenable: authProvider.resendCooldown,
                          builder: (_, resendCooldown, __) => AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            width: double.infinity,
                            child: OutlinedButton(
                              onPressed: authProvider.isLoading || resendCooldown > 0
                                  ? null
                                  : () => _resendOTP(authProvider.otpMethod),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: theme.colorScheme.primary,
                                side: BorderSide(color: theme.colorScheme.primary),
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                              child: Text(
                                resendCooldown > 0 ? 'Resend in ${resendCooldown}s' : 'Resend OTP',
                                style: theme.textTheme.labelLarge?.copyWith(
                                  color: theme.colorScheme.primary,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ] else ...[
                        TextFormField(
                          controller: _newPasswordController,
                          focusNode: _newPasswordFocusNode,
                          decoration: InputDecoration(
                            labelText: 'New Password',
                            labelStyle: TextStyle(color: theme.colorScheme.onSurfaceVariant),
                            prefixIcon: Icon(Icons.lock, color: theme.colorScheme.primary),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscureNewPassword ? Icons.visibility_off : Icons.visibility,
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                              onPressed: () => setState(() => _obscureNewPassword = !_obscureNewPassword),
                            ),
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
                            errorText: _errors['newPassword']?.isNotEmpty == true ? _errors['newPassword'] : null,
                            errorStyle: TextStyle(color: theme.colorScheme.error),
                          ),
                          enabled: !authProvider.isLoading,
                          obscureText: _obscureNewPassword,
                          onChanged: (_) => _validateForm(),
                          autocorrect: false,
                          style: TextStyle(color: theme.colorScheme.onSurface),
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _confirmPasswordController,
                          focusNode: _confirmPasswordFocusNode,
                          decoration: InputDecoration(
                            labelText: 'Confirm Password',
                            labelStyle: TextStyle(color: theme.colorScheme.onSurfaceVariant),
                            prefixIcon: Icon(Icons.lock, color: theme.colorScheme.primary),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscureConfirmPassword ? Icons.visibility_off : Icons.visibility,
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                              onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                            ),
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
                          obscureText: _obscureConfirmPassword,
                          onChanged: (_) => _validateForm(),
                          autocorrect: false,
                          style: TextStyle(color: theme.colorScheme.onSurface),
                        ),
                        const SizedBox(height: 24),
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: authProvider.isLoading ? null : _resetPassword,
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
                              'Reset Password',
                              style: theme.textTheme.labelLarge?.copyWith(
                                color: theme.colorScheme.onPrimary,
                              ),
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      TextButton(
                        onPressed: () => _handleNavigation(context),
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
}