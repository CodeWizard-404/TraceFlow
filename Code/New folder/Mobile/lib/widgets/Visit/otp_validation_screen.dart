import 'package:flutter/material.dart';
import '../../widgets/appbar/app_bar.dart';
import '../../widgets/commen/button.dart';
import '../../widgets/commen/spacer.dart';
import '../../widgets/commen/snack_bar.dar.dart';

class OTPValidationScreen extends StatefulWidget {
  final String visitId;
  final Function(String) onOTPValidated;

  const OTPValidationScreen({
    super.key,
    required this.visitId,
    required this.onOTPValidated,
  });

  @override
  _OTPValidationScreenState createState() => _OTPValidationScreenState();
}

class _OTPValidationScreenState extends State<OTPValidationScreen> {
  final TextEditingController _otpController = TextEditingController();
  bool _isValidating = false;
  int _otpTimer = 600; // 10 minutes in seconds

  @override
  void initState() {
    super.initState();
    _startOTPTimer();
  }

  void _startOTPTimer() {
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted && _otpTimer > 0) {
        setState(() => _otpTimer--);
        _startOTPTimer();
      } else if (_otpTimer <= 0) {
        CustomSnackBar.show(
          context: context,
          message: 'OTP has expired. Please scan QR code again.',
          backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
        );
        Navigator.pop(context);
      }
    });
  }

  String _formatTime(int seconds) {
    final minutes = seconds ~/ 60;
    final secs = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  Future<void> _validateOTP() async {
    if (_otpController.text.isEmpty) {
      CustomSnackBar.show(
        context: context,
        message: 'Please enter the OTP',
        backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
      );
      return;
    }

    setState(() => _isValidating = true);
    try {
      // Call the provided callback with the OTP
      await widget.onOTPValidated(_otpController.text);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      CustomSnackBar.show(
        context: context,
        message: 'Invalid OTP: $e',
        backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
      );
    } finally {
      setState(() => _isValidating = false);
    }
  }

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: CustomAppBar(title: 'Enter OTP', showBackButton: true),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'OTP expires in: ${_formatTime(_otpTimer)}',
              style: theme.textTheme.bodyMedium?.copyWith(
                color:
                    _otpTimer <= 30
                        ? theme.colorScheme.error
                        : theme.colorScheme.onSurface,
                fontWeight: FontWeight.w600,
              ),
            ),
            const CustomSpacer(height: 16),
            TextField(
              controller: _otpController,
              decoration: InputDecoration(
                labelText: 'Enter OTP',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                prefixIcon: Icon(Icons.lock, color: theme.colorScheme.primary),
              ),
              keyboardType: TextInputType.number,
              enabled: !_isValidating,
            ),
            const CustomSpacer(height: 24),
            CustomButton(
              label: _isValidating ? 'Validating...' : 'Validate OTP',
              icon: Icons.check,
              onPressed: _validateOTP,
              isLoading: _isValidating,
              backgroundColor:
                  _isValidating
                      ? theme.colorScheme.secondary.withOpacity(0.6)
                      : theme.colorScheme.primary,
            ),
            if (_isValidating)
              const Padding(
                padding: EdgeInsets.only(top: 16.0),
                child: Center(child: CircularProgressIndicator()),
              ),
          ],
        ),
      ),
    );
  }
}
