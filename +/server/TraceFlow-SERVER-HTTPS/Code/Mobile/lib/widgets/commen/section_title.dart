import 'package:flutter/material.dart';

class CustomSectionTitle extends StatelessWidget {
  final String text;
  final Color? color;

  const CustomSectionTitle({
    required this.text,
    this.color,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Text(
      text,
      style: theme.textTheme.headlineSmall?.copyWith(
        fontWeight: FontWeight.w600,
        color: color ?? theme.colorScheme.primary,
        letterSpacing: 0.5,
      ),
    );
  }
}