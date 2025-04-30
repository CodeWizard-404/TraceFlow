import 'package:flutter/material.dart';

class CustomTextButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;
  final Color? color;
  final bool enabled; // Added

  const CustomTextButton({
    required this.label,
    required this.onPressed,
    this.color,
    this.enabled = true, // Default to true
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return TextButton(
      onPressed: enabled ? onPressed : null, // Disable button if not enabled
      child: Text(
        label,
        style: TextStyle(
          color: color ?? (enabled ? theme.colorScheme.primary : theme.colorScheme.primary.withOpacity(0.5)),
          fontSize: 14,
          fontWeight: FontWeight.w500,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}