import 'package:flutter/material.dart';

class CustomViewSelector extends StatelessWidget {
  final String value;
  final Function(String) onChanged;

  const CustomViewSelector({
    required this.value,
    required this.onChanged,
    super.key,
  });

  static const _views = [
    {'label': 'Day', 'value': 'day', 'icon': Icons.view_day_outlined},
    {'label': 'Week 1', 'value': 'week1', 'icon': Icons.calendar_view_week_rounded},
    {'label': 'Week 2', 'value': 'week2', 'icon': Icons.calendar_view_day_rounded},
    {'label': 'Month', 'value': 'month', 'icon': Icons.calendar_month_rounded},
    {'label': 'Year', 'value': 'year', 'icon': Icons.calendar_today_rounded},
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return PopupMenuButton<String>(
      initialValue: value,
      onSelected: onChanged,
      itemBuilder: (context) => _views.map((view) {
        return PopupMenuItem<String>(
          value: view['value'] as String,
          child: Row(
            children: [
              Icon(
                view['icon'] as IconData,
                size: 20,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(width: 8),
              Text(
                view['label'] as String,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w500,
                  color: theme.colorScheme.onSurface,
                ),
              ),
            ],
          ),
        );
      }).toList(),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface.withOpacity(0.9),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: theme.dividerColor),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _views.firstWhere((v) => v['value'] == value)['icon'] as IconData,
              size: 20,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(width: 6),
            Text(
              _views.firstWhere((v) => v['value'] == value)['label'] as String,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}