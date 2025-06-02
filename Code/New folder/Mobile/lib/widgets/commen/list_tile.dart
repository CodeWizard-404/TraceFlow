import 'package:flutter/material.dart';

class CustomListTile extends StatelessWidget {
  final String title;
  final String? subtitle;
  final IconData? leadingIcon;
  final VoidCallback? onTap;

  const CustomListTile({
    required this.title,
    this.subtitle,
    this.leadingIcon,
    this.onTap,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListTile(
      leading: leadingIcon != null
          ? Icon(leadingIcon, color: theme.colorScheme.primary)
          : null,
      title: Text(
        title,
        style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
      ),
      subtitle: subtitle != null
          ? Text(
        subtitle!,
        style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey),
      )
          : null,
      onTap: onTap,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      tileColor: theme.colorScheme.surface.withOpacity(0.9),
    );
  }
}