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
  int _timer = 600; // 10 minutes
  int _resendCooldown = 0;
  bool _showResetFields = false;

  @override
  void initState() {
    super.initState();
    debugPrint('VerifyResetScreen initialized');
    _startTimer();
  }

  @override
  void dispose() {
    _otpController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    debugPrint('VerifyResetScreen disposed');
    super.dispose();
  }

  void _startTimer() {
    debugPrint('Starting reset timer');
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (mounted) {
        setState(() {
          if (_timer > 0) _timer--;
          if (_resendCooldown > 0) _resendCooldown--;
        });
        return _timer > 0 || _resendCooldown > 0;
      }
      return false;
    });
  }

  Future<void> _verifyResetOTP() async {
    if (!_formKey.currentState!.validate()) {
      debugPrint('OTP validation failed');
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    try {
      debugPrint('Verifying reset OTP...');
      await authProvider.verifyPasswordResetOTP(_otpController.text.trim());
      if (mounted) {
        setState(() {
          _showResetFields = true;
          _otpController.clear();
        });
        debugPrint('OTP verified, showing reset fields');
      }
    } catch (e) {
      debugPrint('Reset OTP verification error: $e');
      if (mounted) {
        _showErrorSnackBar(_parseError(e.toString()));
      }
    }
  }

  Future<void> _resetPassword() async {
    if (!_formKey.currentState!.validate()) {
      debugPrint('Password reset validation failed');
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    try {
      debugPrint('Resetting password...');
      await authProvider.resetPassword(_newPasswordController.text.trim());
      if (mounted) {
        _showSuccessSnackBar('Password reset successfully. Please log in.');
        Navigator.popUntil(context, (route) => route.isFirst); // Back to login
      }
    } catch (e) {
      debugPrint('Password reset error: $e');
      if (mounted) {
        _showErrorSnackBar(_parseError(e.toString()));
      }
    }
  }

  Future<void> _resend2FA() async {
    if (_resendCooldown > 0) return;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    try {
      debugPrint('Resending reset OTP...');
      await authProvider.resend2FA(); // Assuming this works for reset too
      if (mounted) {
        setState(() {
          _timer = 600;
          _resendCooldown = 60;
        });
        _showSuccessSnackBar('New OTP sent successfully.');
      }
    } catch (e) {
      debugPrint('Resend OTP error: $e');
      if (mounted) {
        _showErrorSnackBar(_parseError(e.toString()));
      }
    }
  }

  void _showErrorSnackBar(String message) {
    if (mounted) {
      debugPrint('Showing error snackbar: $message');
      CustomSnackBar.show(
        context: context,
        message: message,
        backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
      );
    }
  }

  void _showSuccessSnackBar(String message) {
    if (mounted) {
      debugPrint('Showing success snackbar: $message');
      CustomSnackBar.show(
        context: context,
        message: message,
        backgroundColor: Colors.green.withOpacity(0.9),
      );
    }
  }

  String _parseError(String error) {
    if (error.contains('2FA verification failed')) {
      return 'Invalid or expired OTP';
    } else {
      return 'An error occurred. Please try again.';
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
    if (!RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[^\s]+$').hasMatch(value)) {
      return 'Must include uppercase, lowercase, number, and special character';
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
    debugPrint('Building VerifyResetScreen, isLoading: ${authProvider.isLoading}');
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
                    ),
                    const CustomSpacer(height: 16),
                    Text(
                      'Time remaining: ${(_timer ~/ 60).toString().padLeft(2, '0')}:${(_timer % 60).toString().padLeft(2, '0')}',
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
                      label: _resendCooldown > 0 ? 'Resend in $_resendCooldown s' : 'Resend OTP',
                      onPressed: _resendCooldown == 0 ? _resend2FA : () {},
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