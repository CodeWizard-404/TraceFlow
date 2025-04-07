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
  int _timer = 600; // 10 minutes
  int _resendCooldown = 0;

  @override
  void initState() {
    super.initState();
    debugPrint('Verify2FAScreen initialized');
    _startTimer();
  }

  @override
  void dispose() {
    _otpController.dispose();
    debugPrint('Verify2FAScreen disposed');
    super.dispose();
  }

  void _startTimer() {
    debugPrint('Starting 2FA timer');
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

  Future<void> _verify2FA() async {
    if (!_formKey.currentState!.validate()) {
      debugPrint('OTP validation failed');
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    try {
      debugPrint('Verifying 2FA with OTP: ${_otpController.text}');
      await authProvider.verify2FA(_otpController.text.trim(), _trustDevice);
      if (mounted && authProvider.isSupervisor) {
        debugPrint('2FA verified, navigating to TimesheetDetailsScreen');
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const TimesheetDetailsScreen()),
        );
      } else if (mounted) {
        debugPrint('Access denied after 2FA');
        _showErrorSnackBar('Access denied: Only Supervisors can log in.');
        await authProvider.logout();
        Navigator.pop(context); // Back to login
      }
    } catch (e) {
      debugPrint('2FA error: $e');
      if (mounted) {
        _showErrorSnackBar(_parseError(e.toString()));
      }
    }
  }

  Future<void> _resend2FA() async {
    if (_resendCooldown > 0) return;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    try {
      debugPrint('Resending 2FA...');
      await authProvider.resend2FA();
      if (mounted) {
        setState(() {
          _timer = 600;
          _resendCooldown = 60;
        });
        _showSuccessSnackBar('New OTP sent successfully.');
      }
    } catch (e) {
      debugPrint('Resend 2FA error: $e');
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

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    debugPrint('Building Verify2FAScreen, isLoading: ${authProvider.isLoading}');
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
                  ),
                  const CustomSpacer(height: 16),
                  Text(
                    'Time remaining: ${(_timer ~/ 60).toString().padLeft(2, '0')}:${(_timer % 60).toString().padLeft(2, '0')}',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const CustomSpacer(height: 16),
                  Row(
                    children: [
                      Checkbox(
                        value: _trustDevice,
                        onChanged: (value) => setState(() => _trustDevice = value!),
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
                    label: _resendCooldown > 0 ? 'Resend in $_resendCooldown s' : 'Resend OTP',
                    onPressed: _resendCooldown == 0 ? _resend2FA : () {},
                    isLoading: authProvider.isLoading,
                    isOutlined: true,
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