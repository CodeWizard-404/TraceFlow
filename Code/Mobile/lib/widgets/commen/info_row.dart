import 'package:flutter/material.dart';
import 'spacer.dart';

class InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;

  const InfoRow({required this.icon, required this.text, super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: theme.colorScheme.onSurface.withOpacity(0.1), // Gray tint
            borderRadius: BorderRadius.circular(6),
          ),
          child: Icon(icon, size: 18, color: theme.colorScheme.onSurface), // Black/gray
        ),
        const CustomSpacer(width: 12),
        Expanded(child: Text(text, style: theme.textTheme.bodyMedium)), // Gray
      ],
    );
  }
}