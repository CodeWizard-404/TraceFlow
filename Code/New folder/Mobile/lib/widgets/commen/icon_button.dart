import 'package:flutter/material.dart';

class CustomIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onPressed;
  final double size;

  const CustomIconButton({
    required this.icon,
    required this.onPressed,
    this.size = 24,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      child: IconButton(
        icon: Icon(icon, size: size),
        color: theme.iconTheme.color,
        onPressed: onPressed,
        splashRadius: 20,
      ),
    );
  }
}