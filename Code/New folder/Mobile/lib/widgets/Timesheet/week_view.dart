import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/timesheet_provider.dart';
import '../commen/empty_state.dart';
import 'day_card.dart';

class WeekViewList extends StatelessWidget {
  final DateTime date;
  final Function(DateTime)? onDayTap;

  const WeekViewList(this.date, {this.onDayTap, super.key});

  List<DateTime> _getWeekDays(DateTime date) {
    final startOfWeek = date.subtract(Duration(days: date.weekday - 1));
    return List.generate(5, (index) => startOfWeek.add(Duration(days: index)));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final weekDays = _getWeekDays(date);

    return Consumer<TimesheetProvider>(
      builder: (context, provider, child) {
        if (provider.timesheets.isEmpty) return const EmptyState(text: 'No timesheets available');
        return ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: weekDays.length,
          padding: EdgeInsets.zero, // Removed vertical padding
          itemBuilder: (context, index) {
            final day = weekDays[index];
            final dayName = DateFormat('EEEE').format(day);
            final chipLabel = DateFormat('d MMM').format(day);
            return DayCard(
              day: day,
              title: dayName,
              chipLabel: chipLabel,
              onTap: onDayTap != null ? () => onDayTap!(day) : null,
            );
          },
        );
      },
    );
  }
}