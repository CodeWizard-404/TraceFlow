import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';

import '../../providers/auth_provider.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ForgotPasswordScreenState createState() => ForgotPasswordScreenState();
}

class ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  Map<String, String> _errors = {};
  String? _successMessage;

  @override
  void dispose() {
    _identifierController.dispose();
    super.dispose();
  }

  String? _validateIdentifier(String? value) {
    if (value?.isEmpty ?? true) return 'Please enter your email or phone number.';
    final emailRegex = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
    final phoneRegex = RegExp(r'^(?:\+\d{11}|\d{8})$');
    if (!emailRegex.hasMatch(value!) && !phoneRegex.hasMatch(value)) {
      return 'Invalid email or phone format. Phone must be 8 digits or + followed by 11 digits.';
    }
    return null;
  }

  bool _validateForm() {
    final newErrors = {
      'identifier': _validateIdentifier(_identifierController.text) ?? '',
    };
    setState(() => _errors = newErrors);
    return newErrors.values.every((err) => err.isEmpty);
  }

  Future<void> _initiatePasswordReset() async {
    if (!_validateForm()) return;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.initiatePasswordReset(_identifierController.text.trim());
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
      } else if (authProvider.userID != null) {
        Navigator.pushNamed(context, '/reset-password');
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
                        'Forgot Password',
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 48),
                      // Identifier field
                      TextFormField(
                        controller: _identifierController,
                        decoration: InputDecoration(
                          labelText: 'Email or Phone',
                          prefixIcon: const Icon(Icons.person),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          errorText: _errors['identifier']?.isNotEmpty == true
                              ? _errors['identifier']
                              : null,
                        ),
                        enabled: !authProvider.isLoading,
                        onChanged: (_) => _validateForm(),
                        keyboardType: TextInputType.emailAddress,
                        autocorrect: false,
                      ),
                      const SizedBox(height: 24),
                      // Send Reset OTP button
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: authProvider.isLoading ? null : _initiatePasswordReset,
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
                            'Send Reset OTP',
                            style: TextStyle(fontSize: 16),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      // Back to login
                      TextButton(
                        onPressed: () => Navigator.pushReplacementNamed(context, '/login'),
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