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

// Forgot password screen for initiating password reset.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ForgotPasswordScreenState createState() => ForgotPasswordScreenState();
}

class ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();

  @override
  void initState() {
    super.initState();
    if (kDebugMode) print('ForgotPasswordScreen initialized');
  }

  @override
  void dispose() {
    _identifierController.dispose();
    super.dispose();
  }

  // Initiates password reset process.
  Future<void> _initiatePasswordReset() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.initiatePasswordReset(_identifierController.text.trim());

    if (authProvider.userID != null && mounted) {
      Navigator.pushNamed(context, '/verify-reset');
    }
  }

  // Validates identifier (email or phone).
  String? _validateIdentifier(String? value) {
    if (value?.trim().isEmpty ?? true) return 'Please enter your email or phone';
    if (!RegExp(r'^([^\s@]+@[^\s@]+\.[^\s@]+|\+?\d{10,15})$').hasMatch(value!)) {
      return 'Invalid email or phone format';
    }
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
                  const CustomTitleText(text: 'Forgot Password'),
                  const CustomSpacer(height: 48),
                  CustomTextField(
                    controller: _identifierController,
                    label: 'Email or Phone',
                    prefixIcon: Icons.person,
                    keyboardType: TextInputType.emailAddress,
                    validator: _validateIdentifier,
                    enabled: !authProvider.isLoading,
                  ),
                  const CustomSpacer(height: 24),
                  CustomButton(
                    label: 'Send Reset OTP',
                    onPressed: _initiatePasswordReset,
                    isLoading: authProvider.isLoading,
                  ),
                  const CustomSpacer(height: 16),
                  CustomTextButton(
                    label: 'Back to Login',
                    onPressed: () => Navigator.pop(context),
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