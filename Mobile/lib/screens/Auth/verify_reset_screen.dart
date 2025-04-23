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

// Password reset verification screen for TraceFlow mobile app.
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
    super.dispose();
  }

  // Verifies password reset OTP.
  Future<void> _verifyResetOTP() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.verifyPasswordResetOTP(_otpController.text.trim());

    if (authProvider.errorMessage == null && mounted) {
      setState(() => _showResetFields = true);
      _otpController.clear();
    }
  }

  // Resets password with new password.
  Future<void> _resetPassword() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.resetPassword(_newPasswordController.text.trim());

    if (authProvider.errorMessage == null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        CustomSnackBar(
          message: 'Password reset successfully. Please log in.',
          backgroundColor: Colors.green.withOpacity(0.9),
        ),
      );
      Navigator.pushReplacementNamed(context, '/login');
    }
  }

  // Resends password reset OTP.
  Future<void> _resendOTP() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (authProvider.resendCooldown > 0) return;

    await authProvider.resend2FA('phone');

    if (authProvider.errorMessage != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        CustomSnackBar(
          message: authProvider.errorMessage!,
          backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
        ),
      );
      authProvider.clearError();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        CustomSnackBar(
          message: 'New OTP sent successfully.',
          backgroundColor: Colors.green.withOpacity(0.9),
        ),
      );
    }
  }

  // Validates OTP code.
  String? _validateOTP(String? value) {
    if (value?.trim().isEmpty ?? true) return 'Please enter the 6-digit OTP';
    if (!RegExp(r'^\d{6}$').hasMatch(value!)) return 'OTP must be 6 digits';
    return null;
  }

  // Validates password.
  String? _validatePassword(String? value) {
    if (value?.trim().isEmpty ?? true) return 'Please enter a password';
    if (value!.length < 8) return 'Password must be at least 8 characters';
    if (value.length > 128) return 'Password cannot exceed 128 characters';
    if (!RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[^\s]+$').hasMatch(value)) {
      return 'Must include uppercase, lowercase, number, and special character';
    }
    return null;
  }

  // Validates confirm password.
  String? _validateConfirmPassword(String? value) {
    if (value?.trim().isEmpty ?? true) return 'Please confirm your password';
    if (value != _newPasswordController.text) return 'Passwords do not match';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    // Handle errors post-build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || authProvider.errorMessage == null) return;
      ScaffoldMessenger.of(context).showSnackBar(
        CustomSnackBar(
          message: authProvider.errorMessage!,
          backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
        ),
      );
      authProvider.clearError();
    });

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
                      label: authProvider.resendCooldown > 0
                          ? 'Resend in ${authProvider.resendCooldown}s'
                          : 'Resend OTP',
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
                    onPressed: () => Navigator.pushReplacementNamed(context, '/login'),
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