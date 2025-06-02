import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../providers/timesheet_provider.dart';
import '../../providers/auth_provider.dart';
import '../commen/empty_state.dart';

class MonthView extends StatelessWidget {
  final DateTime date;
  final Function(DateTime) onDayTap;

  const MonthView({required this.date, required this.onDayTap, super.key});

  List<DateTime> _getMonthDays(DateTime month) {
    final firstDay = DateTime(month.year, month.month, 1);
    final lastDay = DateTime(month.year, month.month + 1, 0);
    final days = <DateTime>[];

    int weekdayOffset = (firstDay.weekday - 1) % 7;
    for (int i = 0; i < weekdayOffset; i++) {
      days.add(DateTime(0));
    }

    for (int i = 0; i < lastDay.day; i++) {
      days.add(firstDay.add(Duration(days: i)));
    }

    return days;
  }

  Map<String, dynamic> _getDayVisits(DateTime day, List timesheets) {
    final localDayStart = DateTime(day.year, day.month, day.day);
    final visits = timesheets
        .expand((t) => t.visits ?? [])
        .where((visit) {
      final visitDate = visit.date != null
          ? DateTime(visit.date!.year, visit.date!.month, visit.date!.day)
          : null;
      return visitDate != null && visitDate.isAtSameMomentAs(localDayStart);
    }).toList();
    return {
      'count': visits.length,
      'preview': visits.isNotEmpty ? visits.take(1).map((v) => v.location ?? 'N/A').join(', ') : '',
    };
  }

  int _getTotalMonthVisits(DateTime month, List timesheets) {
    final firstDay = DateTime(month.year, month.month, 1);
    final lastDay = DateTime(month.year, month.month + 1, 0);
    return timesheets
        .expand((t) => t.visits ?? [])
        .where((visit) {
      final visitDate = visit.date;
      return visitDate != null &&
          visitDate.isAfter(firstDay.subtract(const Duration(days: 1))) &&
          visitDate.isBefore(lastDay.add(const Duration(days: 1)));
    }).length;
  }

  bool _isToday(DateTime day) {
    final today = DateTime.now();
    return day.year == today.year && day.month == today.month && day.day == today.day;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final days = _getMonthDays(date);
    final dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final authProvider = Provider.of<AuthProvider>(context);
    final isSupervisor = authProvider.user?.roles?.contains('SUPERVISOR') ?? false;

    return Consumer<TimesheetProvider>(
      builder: (context, provider, child) {
        if (provider.timesheets.isEmpty) return const EmptyState(text: 'No timesheets available');
        final totalVisits = _getTotalMonthVisits(date, provider.timesheets);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (isSupervisor)
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  IconButton(
                    icon: const Icon(Icons.calendar_today),
                    onPressed: () async {
                      final timesheet = provider.timesheets.firstWhere(
                            (ts) => ts.year == date.year && ts.weekNumber == _getWeekNumber(date),
                        orElse: () => provider.timesheets.first,
                      );
                      await provider.syncTimesheetToCalendar(timesheet.timesheetID);
                    },
                    tooltip: 'Sync to Calendar',
                  ),
                  IconButton(
                    icon: const Icon(Icons.map),
                    onPressed: () {
                      // Navigate to a map screen with month’s visits
                      Navigator.pushNamed(context, '/visits_map', arguments: {
                        'visits': provider.timesheets
                            .expand((t) => t.visits ?? [])
                            .where((v) => v.date.month == date.month)
                            .toList(),
                      });
                    },
                    tooltip: 'View Visits on Map',
                  ),
                ],
              ),
            Row(
              children: dayNames.map((name) {
                final isWeekend = name == 'Sat' || name == 'Sun';
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Text(
                      name,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: isWeekend
                            ? theme.colorScheme.onSurface.withOpacity(0.5)
                            : theme.colorScheme.onSurface,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 7,
                childAspectRatio: 0.8,
                mainAxisSpacing: 2,
                crossAxisSpacing: 2,
              ),
              itemCount: days.length,
              itemBuilder: (context, index) {
                final day = days[index];
                if (day.year == 0) {
                  return Container();
                }

                final visitData = _getDayVisits(day, provider.timesheets);
                final hasVisits = visitData['count'] > 0;
                final isWeekend = day.weekday == 6 || day.weekday == 7;
                final isToday = _isToday(day);

                return GestureDetector(
                  onTap: () => onDayTap(day),
                  child: Container(
                    decoration: BoxDecoration(
                      color: hasVisits
                          ? theme.colorScheme.primary.withOpacity(0.2)
                          : isWeekend
                          ? Colors.grey.withOpacity(0.1)
                          : theme.cardTheme.color,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(
                        color: isToday
                            ? theme.colorScheme.primary.withOpacity(0.7)
                            : theme.dividerColor.withOpacity(0.3),
                        width: isToday ? 2 : 1,
                      ),
                    ),
                    padding: const EdgeInsets.all(4),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '${day.day}',
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: hasVisits
                                    ? theme.colorScheme.primary
                                    : isWeekend
                                    ? theme.colorScheme.onSurface.withOpacity(0.6)
                                    : theme.colorScheme.onSurface,
                                fontWeight: isToday ? FontWeight.bold : FontWeight.normal,
                              ),
                            ),
                            if (hasVisits)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                decoration: BoxDecoration(
                                  color: theme.colorScheme.primary.withOpacity(0.8),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '${visitData['count']}',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: Colors.white,
                                    fontSize: 10,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        if (hasVisits && visitData['preview'].isNotEmpty)
                          Flexible(
                            child: Text(
                              visitData['preview'],
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: isWeekend
                                    ? theme.colorScheme.onSurface.withOpacity(0.5)
                                    : theme.colorScheme.onSurface.withOpacity(0.7),
                                fontSize: 9,
                              ),
                              textAlign: TextAlign.center,
                              overflow: TextOverflow.ellipsis,
                              maxLines: 2,
                            ),
                          ),
                        if (!hasVisits)
                          Text(
                            'No visits',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurface.withOpacity(0.4),
                              fontSize: 9,
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
              decoration: BoxDecoration(
                color: theme.cardTheme.color?.withOpacity(0.8),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Total Visits', style: theme.textTheme.bodySmall),
                  Text(
                    '$totalVisits',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
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