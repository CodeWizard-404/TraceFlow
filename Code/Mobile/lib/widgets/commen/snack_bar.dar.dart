import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

class CustomSnackBar extends SnackBar {
  CustomSnackBar({
    super.key,
    required String message,
    Color? backgroundColor,
    Color? textColor,
    IconData? icon,
    Duration duration = const Duration(seconds: 3),
    SnackBarAction? action,
  }) : super(
    content: Row(
      children: [
        if (icon != null) ...[
          Icon(
            icon,
            color: textColor ?? Colors.white,
            size: 20, // Reduced icon size for smaller appearance
          ),
          const SizedBox(width: 16), // Increased spacing
        ],
        Expanded(
          child: Text(
            message,
            style: TextStyle(
              color: textColor ?? Colors.white,
              fontSize: 14, // Smaller text size (was 16)
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    ),
    backgroundColor: backgroundColor?.withOpacity(0.85), // Added transparency
    duration: duration,
    action: action,
    elevation: 6, // Increased elevation (was 4)
    behavior: SnackBarBehavior.floating,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(8),
      side: BorderSide(
        color: (backgroundColor ?? Colors.grey).withOpacity(0.3),
        width: 1,
      ),
    ),
    margin: const EdgeInsets.all(12), // Increased margin (was 8)
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12), // Added more padding
  );

  static void show({
    required BuildContext context,
    required String message,
    Color? backgroundColor,
    IconData? icon,
    Duration duration = const Duration(seconds: 3),
    String? actionLabel,
    VoidCallback? onActionPressed,
  }) {
    final theme = Theme.of(context);
    ScaffoldMessenger.of(context).removeCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      CustomSnackBar(
        message: message,
        backgroundColor: backgroundColor ?? theme.colorScheme.primary.withOpacity(0.85), // Default transparency
        textColor: theme.colorScheme.onPrimary,
        icon: icon,
        duration: duration,
        action: actionLabel != null && onActionPressed != null
            ? SnackBarAction(
          label: actionLabel,
          textColor: theme.colorScheme.onPrimary,
          onPressed: onActionPressed,
        )
            : null,
      ),
    );
  }
}