import 'package:flutter/material.dart';

class CustomTitleText extends StatelessWidget {
  final String text;
  final Color? color;

  const CustomTitleText({
    required this.text,
    this.color,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Text(
      text,
      style: theme.textTheme.headlineLarge?.copyWith(
        fontWeight: FontWeight.bold,
        color: color ?? theme.colorScheme.primary,
        letterSpacing: 1.0,
      ),
    );
  }
}