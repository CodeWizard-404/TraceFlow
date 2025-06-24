import 'package:flutter/material.dart';

class CustomProgressIndicator extends StatelessWidget {
  final Color? color;

  const CustomProgressIndicator({
    this.color,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: CircularProgressIndicator(
        valueColor: AlwaysStoppedAnimation(color ?? theme.colorScheme.primary),
        strokeWidth: 2,
      ),
    );
  }
}