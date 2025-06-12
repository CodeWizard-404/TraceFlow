import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';

import '../../providers/auth_provider.dart';

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

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (authProvider.errorMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(authProvider.errorMessage!),
            backgroundColor: Theme.of(context).colorScheme.error,
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
            backgroundColor: Colors.green,
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
      body: Stack(
        children: [
          _buildBackgroundOverlay(),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        'Reset Password',
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 48),
                      if (!_showResetFields) ...[
                        TextFormField(
                          controller: _otpController,
                          focusNode: _otpFocusNode,
                          decoration: InputDecoration(
                            labelText: 'Enter Reset OTP',
                            prefixIcon: const Icon(Icons.security),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                            errorText: _errors['otpCode']?.isNotEmpty == true ? _errors['otpCode'] : null,
                          ),
                          enabled: !authProvider.isLoading,
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                          onChanged: (_) => _validateForm(),
                        ),
                        const SizedBox(height: 16),
                        ValueListenableBuilder<int>(
                          valueListenable: authProvider.otpTimer,
                          builder: (_, otpTimer, __) => Text(
                            'We sent a code to your ${authProvider.otpMethod}. '
                                'Time remaining: ${(otpTimer ~/ 60).toString().padLeft(2, '0')}:${(otpTimer % 60).toString().padLeft(2, '0')}',
                            style: const TextStyle(fontSize: 14),
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
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            child: authProvider.isLoading
                                ? const SpinKitCircle(
                              color: Colors.white,
                              size: 24,
                            )
                                : const Text(
                              'Verify OTP',
                              style: TextStyle(fontSize: 16),
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
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                              child: Text(
                                resendCooldown > 0 ? 'Resend in ${resendCooldown}s' : 'Resend OTP',
                                style: const TextStyle(fontSize: 16),
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
                            prefixIcon: const Icon(Icons.lock),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscureNewPassword ? Icons.visibility_off : Icons.visibility,
                              ),
                              onPressed: () => setState(() => _obscureNewPassword = !_obscureNewPassword),
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                            errorText: _errors['newPassword']?.isNotEmpty == true ? _errors['newPassword'] : null,
                          ),
                          enabled: !authProvider.isLoading,
                          obscureText: _obscureNewPassword,
                          onChanged: (_) => _validateForm(),
                          autocorrect: false,
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _confirmPasswordController,
                          focusNode: _confirmPasswordFocusNode,
                          decoration: InputDecoration(
                            labelText: 'Confirm Password',
                            prefixIcon: const Icon(Icons.lock),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscureConfirmPassword ? Icons.visibility_off : Icons.visibility,
                              ),
                              onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                            errorText: _errors['confirmPassword']?.isNotEmpty == true
                                ? _errors['confirmPassword']
                                : null,
                          ),
                          enabled: !authProvider.isLoading,
                          obscureText: _obscureConfirmPassword,
                          onChanged: (_) => _validateForm(),
                          autocorrect: false,
                        ),
                        const SizedBox(height: 24),
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: authProvider.isLoading ? null : _resetPassword,
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            child: authProvider.isLoading
                                ? const SpinKitCircle(
                              color: Colors.white,
                              size: 24,
                            )
                                : const Text(
                              'Reset Password',
                              style: TextStyle(fontSize: 16),
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      TextButton(
                        onPressed: () => _handleNavigation(context),
                        child: const Text('Back to Sign In'),
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

  Widget _buildBackgroundOverlay() {
    return Stack(
      children: [
        Container(
          color: Colors.grey[100],
        ),
        Positioned(
          top: 50,
          left: 20,
          child: Icon(Icons.location_pin, size: 40, color: Colors.blue.withOpacity(0.2)),
        ),
        Positioned(
          bottom: 100,
          right: 30,
          child: Icon(Icons.access_time, size: 50, color: Colors.green.withOpacity(0.2)),
        ),
        Positioned(
          top: 200,
          right: 50,
          child: Icon(Icons.qr_code, size: 45, color: Colors.purple.withOpacity(0.2)),
        ),
        Positioned(
          top: 100,
          left: 100,
          child: AnimatedContainer(
            duration: const Duration(seconds: 3),
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: Colors.blue.withOpacity(0.3),
              shape: BoxShape.circle,
            ),
          ),
        ),
      ],
    );
  }
}