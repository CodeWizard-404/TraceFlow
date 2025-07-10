import 'package:flutter/material.dart';

class CustomButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback onPressed;
  final Color? backgroundColor;
  final Color? textColor;
  final bool isLoading;
  final bool isOutlined;

  const CustomButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.backgroundColor,
    this.textColor,
    this.isLoading = false,
    this.isOutlined = false,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final effectiveBackgroundColor =
        backgroundColor ?? theme.colorScheme.primary;
    final effectiveTextColor =
        textColor ?? (isOutlined ? effectiveBackgroundColor : Colors.white);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor:
              isOutlined ? Colors.transparent : effectiveBackgroundColor,
          foregroundColor: effectiveTextColor,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side:
                isOutlined
                    ? BorderSide(color: effectiveBackgroundColor, width: 2)
                    : BorderSide.none,
          ),
          elevation: isOutlined ? 0 : 2,
          shadowColor:
              isOutlined
                  ? Colors.transparent
                  : effectiveBackgroundColor.withOpacity(0.3),
        ),
        child:
            isLoading
                ? SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    color: effectiveTextColor,
                    strokeWidth: 2,
                  ),
                )
                : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (icon != null) ...[
                      Icon(
                        icon,
                        size: 18,
                        color: theme.elevatedButtonTheme.style!.backgroundColor
                            ?.resolve({}),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: effectiveTextColor,
                      ),
                    ),
                  ],
                ),
      ),
    );
  }
}
