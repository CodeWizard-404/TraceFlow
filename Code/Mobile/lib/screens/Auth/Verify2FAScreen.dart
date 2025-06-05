import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import '../../providers/auth_provider.dart';

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
  String? _successMessage;

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  String? _validateOTP(String? value) {
    if (value?.isEmpty ?? true) return 'Please enter the 6-digit OTP.';
    if (!RegExp(r'^\d{6}$').hasMatch(value!)) return 'OTP must be exactly 6 digits.';
    return null;
  }

  bool _validateForm() {
    final newErrors = {
      'otpCode': _validateOTP(_otpController.text) ?? '',
    };
    setState(() => _errors = newErrors);
    return newErrors.values.every((err) => err.isEmpty);
  }

  Future<void> _verify2FA() async {
    if (!_validateForm()) return;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.verify2FA(_otpController.text.trim(), _trustDevice);
  }

  Future<void> _resend2FA(String method) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.resend2FA(method);
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

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
      } else if (authProvider.isAuthenticated && authProvider.permissionsLoaded) {
        Navigator.pushReplacementNamed(context, '/timesheet-details');
      } else if (_successMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_successMessage!),
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 5),
          ),
        );
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
                        'Verify Your Identity',
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 48),
                      // OTP field
                      TextFormField(
                        controller: _otpController,
                        decoration: InputDecoration(
                          labelText: 'Enter OTP',
                          prefixIcon: const Icon(Icons.security),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          errorText: _errors['otpCode']?.isNotEmpty == true
                              ? _errors['otpCode']
                              : null,
                        ),
                        enabled: !authProvider.isLoading,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        onChanged: (_) => _validateForm(),
                      ),
                      const SizedBox(height: 16),
                      // Timer info
                      Text(
                        'We sent a code to your ${authProvider.otpMethod}. '
                            'Time remaining: ${(authProvider.otpTimer ~/ 60).toString().padLeft(2, '0')}:'
                            '${(authProvider.otpTimer % 60).toString().padLeft(2, '0')}',
                        style: const TextStyle(fontSize: 14),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      // Trust device checkbox
                      CheckboxListTile(
                        title: const Text('Trust this device'),
                        value: _trustDevice,
                        onChanged: authProvider.isLoading
                            ? null
                            : (value) => setState(() => _trustDevice = value!),
                        controlAffinity: ListTileControlAffinity.leading,
                      ),
                      const SizedBox(height: 16),
                      // Verify OTP button
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: authProvider.isLoading ? null : _verify2FA,
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
                      // Resend OTP button
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: authProvider.isLoading || authProvider.resendCooldown > 0
                              ? null
                              : () => _resend2FA(authProvider.otpMethod),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                          child: Text(
                            authProvider.resendCooldown > 0
                                ? 'Resend in ${authProvider.resendCooldown}s'
                                : 'Resend OTP',
                            style: const TextStyle(fontSize: 16),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      // Alternate method link
                      if (authProvider.otpMethod == 'phone')
                        TextButton(
                          onPressed: authProvider.isLoading || authProvider.resendCooldown > 0
                              ? null
                              : () => _resend2FA('email'),
                          child: const Text('Can’t access your phone? Send to email instead.'),
                        ),
                      if (authProvider.otpMethod == 'email')
                        TextButton(
                          onPressed: authProvider.isLoading || authProvider.resendCooldown > 0
                              ? null
                              : () => _resend2FA('phone'),
                          child: const Text('Send to phone instead.'),
                        ),
                      const Divider(),
                      // Back to login
                      TextButton(
                        onPressed: () {
                          authProvider.logout();
                          Navigator.pushReplacementNamed(context, '/login');
                        },
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