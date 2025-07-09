import 'package:flutter/material.dart';

class CustomDivider extends StatelessWidget {
  final double thickness;
  final Color? color;

  const CustomDivider({
    this.thickness = 1,
    this.color,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Divider(
      thickness: thickness,
      color: color ?? theme.colorScheme.onSurface.withOpacity(0.2),
    );
  }
}