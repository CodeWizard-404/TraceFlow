import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:TraceFlow/widgets/commen/button.dart';
import 'package:TraceFlow/widgets/commen/spacer.dart';
import '../../models/agent.dart';
import '../../providers/agent_provider.dart';

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
    final theme = Theme.of(context);
    final agentProvider = Provider.of<AgentProvider>(context);

    String recipientName = '';
    if (recipientType == 'Agent' && recipientID != null) {
      final agent = agentProvider.agents.firstWhere(
            (a) => a.agentID == recipientID,
        orElse: () => Agent(
          agentID: '',
          name: 'Unknown',
          lastname: '',
          delegationID: '',
        ),
      );
      recipientName = '${agent.name} ${agent.lastname}';
    } else {
      recipientName = recipientType ?? 'Recipient';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Enter OTP sent to $recipientName',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurface,
            fontWeight: FontWeight.w500,
          ),
        ),
        const CustomSpacer(height: 8),
        TextField(
          controller: otpController,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            filled: true,
            fillColor: theme.colorScheme.background,
            hintText: 'Enter OTP',
            prefixIcon: Icon(
              Icons.lock_outline,
              color: theme.colorScheme.primary,
              size: 18,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(
                color: theme.colorScheme.primary,
                width: 1.5,
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(
                color: theme.colorScheme.primary.withOpacity(0.7),
                width: 1.5,
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(
                color: theme.colorScheme.primary,
                width: 2,
              ),
            ),
            hintStyle: TextStyle(
              color: theme.colorScheme.onSurface.withOpacity(0.6),
            ),
          ),
          style: TextStyle(
            fontSize: 16,
            color: theme.colorScheme.onSurface,
          ),
        ),
        const CustomSpacer(height: 8),
        Text(
          'Time remaining: ${formatTime(otpSecondsRemaining)}',
          style: theme.textTheme.bodySmall?.copyWith(
            color: otpSecondsRemaining <= 30
                ? theme.colorScheme.error
                : theme.colorScheme.onSurface,
          ),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              error!,
              style: TextStyle(
                color: theme.colorScheme.error,
                fontSize: 12,
              ),
            ),
          ),
        const CustomSpacer(height: 8),
        CustomButton(
          label: recipientType == "Stub Collection" ? 'Validate Stub Collection' : 'Validate Transfer',
          icon: Icons.check_circle_outline,
          onPressed: onValidateTransfer,
          backgroundColor: theme.colorScheme.primary.withOpacity(0.8),
          textColor: theme.colorScheme.primary,
          isOutlined: true,
        ),
      ],
    );
  }
}