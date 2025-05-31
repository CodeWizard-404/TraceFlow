import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../main.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/commen/button.dart';
import '../../widgets/commen/snack_bar.dar.dart';
import '../../widgets/commen/spacer.dart';
import '../../widgets/commen/text_button.dart';
import '../../widgets/commen/text_field.dart';
import '../../widgets/commen/title_text.dart';

class Verify2FAScreen extends StatefulWidget {
  const Verify2FAScreen({super.key});

  @override
  Verify2FAScreenState createState() => Verify2FAScreenState();
}

class Verify2FAScreenState extends State<Verify2FAScreen> {
  final _formKey = GlobalKey<FormState>();
  final _otpController = TextEditingController();
  bool _trustDevice = false;

  Future<void> _verify2FA() async {
    if (!_formKey.currentState!.validate()) return;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.verify2FA(_otpController.text.trim(), _trustDevice);
  }

  Future<void> _resend2FA(String method) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (authProvider.resendCooldown > 0) return;
    await authProvider.resend2FA(method);
  }

  String? _validateOTP(String? value) {
    if (value?.isEmpty ?? true) return 'Enter the 6-digit OTP';
    if (!RegExp(r'^\d{6}$').hasMatch(value!)) return 'OTP must be 6 digits';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (authProvider.errorMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          CustomSnackBar(
            message: authProvider.errorMessage!,
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
        authProvider.clearError();
      } else if (authProvider.isAuthenticated && authProvider.permissionsLoaded) {
        Navigator.pushReplacementNamed(context, '/timesheet-details');
      }
    });

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CustomTitleText(text: 'Verify Your Identity'),
                  const CustomSpacer(height: 48),
                  CustomTextField(
                    controller: _otpController,
                    label: 'Enter OTP',
                    prefixIcon: Icons.security,
                    keyboardType: TextInputType.number,
                    validator: _validateOTP,
                    enabled: !authProvider.isLoading,
                    maxLength: 6,
                  ),
                  const CustomSpacer(height: 16),
                  Text(
                    'Sent to your ${authProvider.otpMethod}. Time remaining: '
                        '${(authProvider.otpTimer ~/ 60).toString().padLeft(2, '0')}:'
                        '${(authProvider.otpTimer % 60).toString().padLeft(2, '0')}',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const CustomSpacer(height: 16),
                  CheckboxListTile(
                    title: const Text('Trust this device'),
                    value: _trustDevice,
                    onChanged: authProvider.isLoading
                        ? null
                        : (value) => setState(() => _trustDevice = value!),
                  ),
                  const CustomSpacer(height: 16),
                  CustomButton(
                    label: 'Verify OTP',
                    onPressed: _verify2FA,
                    isLoading: authProvider.isLoading,
                  ),
                  const CustomSpacer(height: 16),
                  CustomButton(
                    label: authProvider.resendCooldown > 0
                        ? 'Resend in ${authProvider.resendCooldown}s'
                        : 'Resend OTP',
                    onPressed: () => _resend2FA(authProvider.otpMethod),
                    isLoading: authProvider.isLoading,
                    isOutlined: true,
                  ),
                  const CustomSpacer(height: 16),
                  if (authProvider.otpMethod == 'phone')
                    CustomTextButton(
                      label: 'Send to email instead',
                      onPressed: () => _resend2FA('email'),
                      enabled: authProvider.resendCooldown == 0 && !authProvider.isLoading,
                    ),
                  if (authProvider.otpMethod == 'email')
                    CustomTextButton(
                      label: 'Send to phone instead',
                      onPressed: () => _resend2FA('phone'),
                      enabled: authProvider.resendCooldown == 0 && !authProvider.isLoading,
                    ),
                  CustomTextButton(
                    label: 'Back to Login',
                    onPressed: () {
                      authProvider.logout();
                      Navigator.pushReplacementNamed(context, '/login');
                    },
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