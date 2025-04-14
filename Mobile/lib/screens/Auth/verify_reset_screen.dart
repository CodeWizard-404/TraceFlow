// lib/screens/verify_reset_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/commen/button.dart';
import '../../widgets/commen/snack_bar.dar.dart';
import '../../widgets/commen/spacer.dart';
import '../../widgets/commen/text_button.dart';
import '../../widgets/commen/text_field.dart';
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
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscureNewPassword = true;
  bool _obscureConfirmPassword = true;
  bool _showResetFields = false;

  @override
  void initState() {
    super.initState();
    if (kDebugMode) print('VerifyResetScreen initialized');
  }

  @override
  void dispose() {
    _otpController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    if (kDebugMode) print('VerifyResetScreen disposed');
    super.dispose();
  }

  Future<void> _verifyResetOTP() async {
    if (!_formKey.currentState!.validate()) {
      if (kDebugMode) print('OTP validation failed');
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.verifyPasswordResetOTP(_otpController.text.trim());

    if (authProvider.errorMessage == null && mounted) {
      setState(() => _showResetFields = true);
      _otpController.clear();
      if (kDebugMode) print('OTP verified, showing reset fields');
    } else if (authProvider.errorMessage != null && mounted) {
      _showErrorSnackBar(authProvider.errorMessage!);
      authProvider.clearError();
    }
  }

  Future<void> _resetPassword() async {
    if (!_formKey.currentState!.validate()) {
      if (kDebugMode) print('Password reset validation failed');
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.resetPassword(_newPasswordController.text.trim());

    if (authProvider.errorMessage != null && mounted) {
      _showErrorSnackBar(authProvider.errorMessage!);
      authProvider.clearError();
    } else if (mounted) {
      _showSuccessSnackBar('Password reset successfully. Please log in.');
      Navigator.popUntil(context, (route) => route.isFirst);
    }
  }

  Future<void> _resendOTP() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (authProvider.resendCooldown > 0) return;

    await authProvider.resend2FA('phone');

    if (authProvider.errorMessage != null && mounted) {
      _showErrorSnackBar(authProvider.errorMessage!);
      authProvider.clearError();
    } else if (mounted) {
      _showSuccessSnackBar('New OTP sent successfully.');
    }
  }

  void _showErrorSnackBar(String message) {
    if (mounted) {
      if (kDebugMode) print('Showing error snackbar: $message');
      CustomSnackBar.show(
        context: context,
        message: message,
        backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
      );
    }
  }

  void _showSuccessSnackBar(String message) {
    if (mounted) {
      if (kDebugMode) print('Showing success snackbar: $message');
      CustomSnackBar.show(
        context: context,
        message: message,
        backgroundColor: Colors.green.withOpacity(0.9),
      );
    }
  }

  String? _validateOTP(String? value) {
    if (value?.trim().isEmpty ?? true) return 'Please enter the 6-digit OTP';
    if (!RegExp(r'^\d{6}$').hasMatch(value!)) return 'OTP must be 6 digits';
    return null;
  }

  String? _validatePassword(String? value) {
    if (value?.trim().isEmpty ?? true) return 'Please enter a password';
    if (value!.length < 8) return 'Password must be at least 8 characters';
    if (value.length > 128) return 'Password cannot exceed 128 characters';
    if (!RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[^\s]+$').hasMatch(value)) {
      return 'Must include uppercase, lowercase, number, and special character (no spaces)';
    }
    return null;
  }

  String? _validateConfirmPassword(String? value) {
    if (value?.trim().isEmpty ?? true) return 'Please confirm your password';
    if (value != _newPasswordController.text) return 'Passwords do not match';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    if (kDebugMode) print('Building VerifyResetScreen, isLoading: ${authProvider.isLoading}');
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CustomTitleText(text: 'Reset Password'),
                  const CustomSpacer(height: 48),
                  if (!_showResetFields) ...[
                    CustomTextField(
                      controller: _otpController,
                      label: 'Enter Reset OTP',
                      prefixIcon: Icons.security,
                      keyboardType: TextInputType.number,
                      validator: _validateOTP,
                      enabled: !authProvider.isLoading,
                      maxLength: 6,
                    ),
                    const CustomSpacer(height: 16),
                    Text(
                      'Time remaining: ${(authProvider.otpTimer ~/ 60).toString().padLeft(2, '0')}:${(authProvider.otpTimer % 60).toString().padLeft(2, '0')}',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const CustomSpacer(height: 24),
                    CustomButton(
                      label: 'Verify OTP',
                      onPressed: _verifyResetOTP,
                      isLoading: authProvider.isLoading,
                    ),
                    const CustomSpacer(height: 16),
                    CustomButton(
                      label: authProvider.resendCooldown > 0 ? 'Resend in ${authProvider.resendCooldown}s' : 'Resend OTP',
                      onPressed: authProvider.resendCooldown == 0 ? _resendOTP : () {},
                      isLoading: authProvider.isLoading,
                      isOutlined: true,
                    ),
                  ] else ...[
                    CustomTextField(
                      controller: _newPasswordController,
                      label: 'New Password',
                      prefixIcon: Icons.lock,
                      suffixIcon: _obscureNewPassword ? Icons.visibility : Icons.visibility_off,
                      obscureText: _obscureNewPassword,
                      onSuffixPressed: () => setState(() => _obscureNewPassword = !_obscureNewPassword),
                      validator: _validatePassword,
                      enabled: !authProvider.isLoading,
                    ),
                    const CustomSpacer(height: 16),
                    CustomTextField(
                      controller: _confirmPasswordController,
                      label: 'Confirm Password',
                      prefixIcon: Icons.lock,
                      suffixIcon: _obscureConfirmPassword ? Icons.visibility : Icons.visibility_off,
                      obscureText: _obscureConfirmPassword,
                      onSuffixPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                      validator: _validateConfirmPassword,
                      enabled: !authProvider.isLoading,
                    ),
                    const CustomSpacer(height: 24),
                    CustomButton(
                      label: 'Reset Password',
                      onPressed: _resetPassword,
                      isLoading: authProvider.isLoading,
                    ),
                  ],
                  const CustomSpacer(height: 16),
                  CustomTextButton(
                    label: 'Back to Login',
                    onPressed: () => Navigator.popUntil(context, (route) => route.isFirst),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}