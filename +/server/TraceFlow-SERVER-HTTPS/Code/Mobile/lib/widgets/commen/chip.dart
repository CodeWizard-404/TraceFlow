import 'package:flutter/material.dart';

class CustomChip extends StatelessWidget {
  final String label;
  final VoidCallback? onDeleted;
  final Color? backgroundColor;
  final Color? textColor;

  const CustomChip({
    required this.label,
    this.onDeleted,
    this.backgroundColor,
    this.textColor,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Chip(
      label: Text(
        label,
        style: theme.textTheme.bodyMedium?.copyWith(
          color: textColor ?? theme.colorScheme.primary,
        ),
      ),
      deleteIcon: onDeleted != null ? Icon(Icons.close, size: 18) : null,
      onDeleted: onDeleted,
      backgroundColor: backgroundColor ?? theme.colorScheme.primary.withOpacity(0.1),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      padding: const EdgeInsets.symmetric(horizontal: 8),
    );
  }
}