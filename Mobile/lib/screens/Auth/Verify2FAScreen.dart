import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/commen/button.dart';
import '../../widgets/commen/snack_bar.dar.dart';
import '../../widgets/commen/spacer.dart';
import '../../widgets/commen/text_button.dart';
import '../../widgets/commen/text_field.dart';
import '../../widgets/commen/title_text.dart';
import '../Timesheet/Timesheet_details.dart';
import 'package:flutter/foundation.dart';

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
    if (kDebugMode) print('Verify2FAScreen disposed');
    super.dispose();
  }

  Future<void> _verify2FA() async {
    if (!_formKey.currentState!.validate()) {
      if (kDebugMode) print('OTP validation failed');
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (kDebugMode) print('Attempting OTP verification with code: ${_otpController.text}');
    await authProvider.verify2FA(_otpController.text.trim(), _trustDevice);
    if (kDebugMode) print('OTP verification attempt completed');
  }

  Future<void> _resend2FA(String method) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (authProvider.resendCooldown > 0) return;

    await authProvider.resend2FA(method);

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

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (authProvider.errorMessage != null) {
        _showErrorSnackBar(authProvider.errorMessage!);
        authProvider.clearError();
      } else if (authProvider.token != null && authProvider.permissionsLoaded && authProvider.isSupervisor) {
        if (kDebugMode) print('Navigating to TimesheetDetailsScreen (Home) from listener');
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const TimesheetDetailsScreen()),
        );
      } else if (authProvider.token != null && authProvider.permissionsLoaded && !authProvider.isSupervisor) {
        if (kDebugMode) print('Access denied: Not a supervisor');
        _showErrorSnackBar('Access denied: Only Supervisors can log in.');
        authProvider.logout();
      }
    });

    if (kDebugMode) print('Building Verify2FAScreen, isLoading: ${authProvider.isLoading}');
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
                        onChanged: authProvider.isLoading ? null : (value) => setState(() => _trustDevice = value!),
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
                    label: authProvider.resendCooldown > 0 ? 'Resend in ${authProvider.resendCooldown}s' : 'Resend OTP',
                    onPressed: authProvider.resendCooldown == 0 ? () => _resend2FA(authProvider.otpMethod) : () {},
                    isLoading: authProvider.isLoading,
                    isOutlined: true,
                  ),
                  const CustomSpacer(height: 16),
                  if (authProvider.otpMethod == 'phone')
                    CustomTextButton(
                      label: 'Can’t access your phone? Send to email instead.',
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