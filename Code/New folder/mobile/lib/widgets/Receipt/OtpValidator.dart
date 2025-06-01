import 'package:flutter/material.dart';
import 'package:TraceFlow/widgets/commen/button.dart';
import 'package:TraceFlow/widgets/commen/spacer.dart';
import 'package:TraceFlow/widgets/commen/text_field.dart';

class OtpValidator extends StatelessWidget {
  final String? recipientType;
  final String? recipientID;
  final int otpSecondsRemaining;
  final String? error;
  final TextEditingController otpController;
  final Future<void> Function() onValidateTransfer;
  final String Function(int) formatTime;

  const OtpValidator({
    required this.recipientType,
    required this.recipientID,
    required this.otpSecondsRemaining,
    required this.error,
    required this.otpController,
    required this.onValidateTransfer,
    required this.formatTime,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'OTP expires in: ${formatTime(otpSecondsRemaining)}',
          style: TextStyle(color: otpSecondsRemaining <= 30 ? Colors.red : null),
        ),
        const CustomSpacer(height: 16),
        CustomTextField(
          controller: otpController,
          label: 'Enter OTP',
          keyboardType: TextInputType.number,
        ),
        if (error != null) ...[
          const CustomSpacer(height: 16),
          Text(error!, style: const TextStyle(color: Colors.red)),
        ],
        const CustomSpacer(height: 16),
        CustomButton(
          label: recipientType == "Stub Collection" ? 'Validate Stub Collection' : 'Validate Transfer',
          icon: Icons.check,
          onPressed: onValidateTransfer,
        ),
      ],
    );
  }
}