import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/timesheet_provider.dart';
import '../../providers/auth_provider.dart';
import '../commen/empty_state.dart';
import 'TimesheetSuggestionsModal.dart';
import 'day_card.dart';

class WeekViewList extends StatelessWidget {
  final DateTime date;
  final Function(DateTime)? onDayTap;
  final GlobalKey<ScaffoldMessengerState> scaffoldMessengerKey;

  const WeekViewList(
      this.date, {
        this.onDayTap,
        required this.scaffoldMessengerKey,
        super.key,
      });

  List<DateTime> _getWeekDays(DateTime date) {
    final startOfWeek = date.subtract(Duration(days: date.weekday - 1));
    return List.generate(7, (index) => startOfWeek.add(Duration(days: index)));
  }

  int _getWeekNumber(DateTime date) {
    final startOfYear = DateTime(date.year, 1, 1);
    final firstMonday = startOfYear.weekday <= 4
        ? startOfYear.subtract(Duration(days: startOfYear.weekday - 1))
        : startOfYear.add(Duration(days: 8 - startOfYear.weekday));
    return (date.difference(firstMonday).inDays ~/ 7) + 1;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final weekDays = _getWeekDays(date);
    final authProvider = Provider.of<AuthProvider>(context);

    return Consumer<TimesheetProvider>(
      builder: (context, provider, child) {
        if (provider.timesheets.isEmpty) return const EmptyState(text: 'No timesheets available');
        return Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                IconButton(
                  icon: Icon(Icons.calendar_today, color: theme.colorScheme.primary),
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
                  icon: Icon(Icons.lightbulb, color:Colors.red),

                  onPressed: () {
                    TimesheetSuggestionsModal.show(
                      context: context,
                      weekNumber: _getWeekNumber(date),
                      year: date.year,
                      supervisorID: authProvider.user!.userID,
                      scaffoldMessengerKey: scaffoldMessengerKey,
                    );
                  },
                  tooltip: 'Generate Timesheet Suggestions',
                ),
                IconButton(
                  icon: Icon(Icons.map, color: theme.colorScheme.primary),
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
}