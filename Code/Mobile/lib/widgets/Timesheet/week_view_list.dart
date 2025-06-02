import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/timesheet_provider.dart';
import '../../providers/auth_provider.dart';
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
    final authProvider = Provider.of<AuthProvider>(context);
    final isSupervisor = authProvider.user?.roles?.contains('SUPERVISOR') ?? false;

    return Consumer<TimesheetProvider>(
      builder: (context, provider, child) {
        if (provider.timesheets.isEmpty) return const EmptyState(text: 'No timesheets available');
        return Column(
          children: [
            if (isSupervisor)
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  IconButton(
                    icon: const Icon(Icons.calendar_today),
                    onPressed: () async {
                      final timesheet = provider.timesheets.firstWhere(
                            (ts) => ts.weekNumber == _getWeekNumber(date),
                        orElse: () => provider.timesheets.first,
                      );
                      await provider.syncTimesheetToCalendar(timesheet.timesheetID);
                    },
                    tooltip: 'Sync to Calendar',
                  ),
                  IconButton(
                    icon: const Icon(Icons.lightbulb),
                    onPressed: () async {
                      await provider.suggestTimesheet(
                        supervisorID: authProvider.user!.userID,
                        weekNumber: _getWeekNumber(date),
                        year: date.year,
                        coordinates: {'lat': 36.8065, 'lng': 10.1815},
                      );
                    },
                    tooltip: 'Generate Timesheet Suggestions',
                  ),
                  IconButton(
                    icon: const Icon(Icons.map),
                    onPressed: () {
                      Navigator.pushNamed(context, '/visits_map', arguments: {
                        'visits': provider.timesheets
                            .expand((t) => t.visits ?? [])
                            .where((v) => _getWeekNumber(v.date) == _getWeekNumber(date))
                            .toList(),
                      });
                    },
                    tooltip: 'View Visits on Map',
                  ),
                ],
              ),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: weekDays.length,
              padding: EdgeInsets.zero,
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
            ),
          ],
        );
      },
    );
  }

  int _getWeekNumber(DateTime date) {
    final startOfYear = DateTime(date.year, 1, 1);
    final firstMonday = startOfYear.weekday <= 4
        ? startOfYear.subtract(Duration(days: startOfYear.weekday - 1))
        : startOfYear.add(Duration(days: 8 - startOfYear.weekday));
    return (date.difference(firstMonday).inDays ~/ 7) + 1;
  }
}