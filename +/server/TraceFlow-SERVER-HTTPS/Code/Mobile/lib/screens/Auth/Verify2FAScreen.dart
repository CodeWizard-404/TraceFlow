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
import 'package:flutter/foundation.dart';

// 2FA verification screen for TraceFlow mobile app.
class Verify2FAScreen extends StatefulWidget {
  const Verify2FAScreen({super.key});

  @override
  Verify2FAScreenState createState() => Verify2FAScreenState();
}

class Verify2FAScreenState extends State<Verify2FAScreen> {
  final _formKey = GlobalKey<FormState>();
  final _otpController = TextEditingController();
  bool _trustDevice = false;

  @override
  void initState() {
    super.initState();
    if (kDebugMode) print('Verify2FAScreen initialized');
  }

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  // Verifies 2FA OTP code.
  Future<void> _verify2FA() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.verify2FA(_otpController.text.trim(), _trustDevice);

    // Navigate after successful verification
    if (authProvider.isAuthenticated && authProvider.permissionsLoaded && mounted) {
      if (ModalRoute.of(context)?.settings.name != '/timesheet-details') {
        NavigationService.navigatorKey.currentState?.pushReplacementNamed('/timesheet-details');
      }
    }
  }

  // Resends 2FA OTP.
  Future<void> _resend2FA(String method) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (authProvider.resendCooldown > 0) return;

    await authProvider.resend2FA(method);

    if (!mounted) return;
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

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    // Handle errors post-build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (authProvider.errorMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          CustomSnackBar(
            message: authProvider.errorMessage!,
            backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
          ),
        );
        authProvider.clearError();
      } else if (authProvider.permissionsLoaded && !authProvider.isSupervisor) {
        ScaffoldMessenger.of(context).showSnackBar(
          CustomSnackBar(
            message: 'Access denied: Only Supervisors can log in.',
            backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
          ),
        );
        authProvider.logout();
        if (ModalRoute.of(context)?.settings.name != '/login') {
          NavigationService.navigatorKey.currentState?.pushReplacementNamed('/login');
        }
      }
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
                  const CustomTitleText(text: 'Verify 2FA'),
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
                    'Time remaining: ${(authProvider.otpTimer ~/ 60).toString().padLeft(2, '0')}:${(authProvider.otpTimer % 60).toString().padLeft(2, '0')}',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const CustomSpacer(height: 16),
                  Row(
                    children: [
                      Checkbox(
                        value: _trustDevice,
                        onChanged: authProvider.isLoading
                            ? null
                            : (value) => setState(() => _trustDevice = value!),
                        checkColor: Colors.white,
                        fillColor: MaterialStateProperty.resolveWith((states) => Colors.blue),
                      ),
                      Expanded(
                        child: Text(
                          'Trust this device',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                    ],
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
                    onPressed: authProvider.resendCooldown == 0
                        ? () => _resend2FA(authProvider.otpMethod)
                        : () {},
                    isLoading: authProvider.isLoading,
                    isOutlined: true,
                  ),
                  const CustomSpacer(height: 16),
                  if (authProvider.otpMethod == 'phone')
                    CustomTextButton(
                      label: 'Send to email instead.',
                      onPressed: () => _resend2FA('email'),
                      enabled: authProvider.resendCooldown == 0 && !authProvider.isLoading,
                    ),
                  if (authProvider.otpMethod == 'email') ...[
                    const Divider(),
                    CustomTextButton(
                      label: 'Send to phone instead.',
                      onPressed: () => _resend2FA('phone'),
                      enabled: authProvider.resendCooldown == 0 && !authProvider.isLoading,
                    ),
                  ],
                  CustomTextButton(
                    label: 'Back to Login',
                    onPressed: () {
                      authProvider.logout();
                      if (mounted) {
                        NavigationService.navigatorKey.currentState?.pushReplacementNamed('/login');
                      }
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