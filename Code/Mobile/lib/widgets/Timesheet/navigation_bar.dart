import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../commen/icon_button.dart';

class TimesheetNavigationBar extends StatelessWidget {
  final String currentView;
  final DateTime currentDate;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  const TimesheetNavigationBar({
    required this.currentView,
    required this.currentDate,
    required this.onPrevious,
    required this.onNext,
    super.key,
  });

  int _getWeekNumber(DateTime date) {
    final startOfYear = DateTime(date.year, 1, 1);
    final firstMonday = startOfYear.weekday <= 4
        ? startOfYear.subtract(Duration(days: startOfYear.weekday - 1))
        : startOfYear.add(Duration(days: 8 - startOfYear.weekday));
    return (date.difference(firstMonday).inDays ~/ 7) + 1;
  }

  String _getTitle() {
    switch (currentView) {
      case 'day':
        return DateFormat('MMMM d').format(currentDate);
      case 'week1':
        return 'Week ${_getWeekNumber(currentDate)}';
      case 'week2':
        return 'Week ${_getWeekNumber(currentDate)}';
      case 'month':
        return DateFormat('MMMM yyyy').format(currentDate);
      case 'year':
        return '${currentDate.year}';
      default:
        return 'Unknown';
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          CustomIconButton(
            icon: Icons.chevron_left_rounded,
            onPressed: onPrevious,
            size: 24,
          ),
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: theme.colorScheme.surface.withOpacity(0.9),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: theme.dividerColor),
            ),
            child: Text(
              _getTitle(),
              style: theme.textTheme.headlineSmall?.copyWith(
                fontSize: 16,
                color: theme.colorScheme.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          CustomIconButton(
            icon: Icons.chevron_right_rounded,
            onPressed: onNext,
            size: 24,
          ),
        ],
      ),
    );
  }
}