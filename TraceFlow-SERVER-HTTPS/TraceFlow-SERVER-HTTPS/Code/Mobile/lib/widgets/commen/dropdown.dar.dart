import 'package:flutter/material.dart';

class CustomDropdown<T> extends StatelessWidget {
  final T? value;
  final List<T> items;
  final String hint;
  final void Function(T?) onChanged;
  final IconData? icon;
  final String Function(T)? itemToString;

  const CustomDropdown({
    required this.value,
    required this.items,
    required this.hint,
    required this.onChanged,
    this.icon,
    this.itemToString,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.dividerColor.withOpacity(0.2)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          items: items.map((item) {
            return DropdownMenuItem<T>(
              value: item,
              child: Row(
                children: [
                  if (icon != null) ...[
                    Icon(icon, color: theme.colorScheme.primary, size: 20),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    itemToString != null ? itemToString!(item) : item.toString(),
                    style: theme.textTheme.bodyMedium,
                  ),
                ],
              ),
            );
          }).toList(),
          onChanged: onChanged,
          hint: Text(hint, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurface.withOpacity(0.6))),
          icon: Icon(Icons.arrow_drop_down, color: theme.colorScheme.onSurface.withOpacity(0.6)),
          isExpanded: true,
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }
}