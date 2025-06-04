import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../providers/timesheet_provider.dart';
import '../../providers/auth_provider.dart';
import '../commen/empty_state.dart';

class YearView extends StatelessWidget {
  final DateTime date;
  final Function(DateTime) onMonthTap;

  const YearView({required this.date, required this.onMonthTap, super.key});

  List<DateTime> _getYearMonths(DateTime year) {
    return List.generate(12, (index) => DateTime(year.year, index + 1, 1));
  }

  Map<String, dynamic> _getMonthVisits(DateTime month, List timesheets) {
    final firstDay = DateTime(month.year, month.month, 1);
    final lastDay = DateTime(month.year, month.month + 1, 0);
    final visits = timesheets.expand((t) => t.visits ?? []).where((visit) {
      final visitDate = visit.date;
      return visitDate != null &&
          visitDate.isAfter(firstDay.subtract(const Duration(days: 1))) &&
          visitDate.isBefore(lastDay.add(const Duration(days: 1)));
    }).toList();
    return {
      'count': visits.length,
      'preview': visits.isNotEmpty ? visits.take(1).map((v) => v.location ?? 'N/A').join(', ') : '',
    };
  }

  int _getTotalYearVisits(DateTime year, List timesheets) {
    final firstDay = DateTime(year.year, 1, 1);
    final lastDay = DateTime(year.year + 1, 1, 0);
    return timesheets.expand((t) => t.visits ?? []).where((visit) {
      final visitDate = visit.date;
      return visitDate != null &&
          visitDate.isAfter(firstDay.subtract(const Duration(days: 1))) &&
          visitDate.isBefore(lastDay.add(const Duration(days: 1)));
    }).length;
  }

  bool _isCurrentMonth(DateTime month) {
    final now = DateTime.now();
    return month.year == now.year && month.month == now.month;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final months = _getYearMonths(date);
    final authProvider = Provider.of<AuthProvider>(context);
    final isSupervisor = authProvider.user?.roles?.contains('SUPERVISOR') ?? false;

    return Consumer<TimesheetProvider>(
      builder: (context, provider, child) {
        if (provider.timesheets.isEmpty) return const EmptyState(text: 'No timesheets available');
        final totalVisits = _getTotalYearVisits(date, provider.timesheets);
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
                            (ts) => ts.year == date.year,
                        orElse: () => provider.timesheets.first,
                      );
                      await provider.syncTimesheetToCalendar(timesheet.timesheetID);
                    },
                    tooltip: 'Sync to Calendar',
                  ),
                  IconButton(
                    icon: const Icon(Icons.map),
                    onPressed: () {
                      Navigator.pushNamed(context, '/visits_map', arguments: {
                        'visits': provider.timesheets
                            .expand((t) => t.visits ?? [])
                            .where((v) => v.date.year == date.year)
                            .toList(),
                      });
                    },
                    tooltip: 'View Visits on Map',
                  ),
                ],
              ),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                childAspectRatio: 1.5,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
              ),
              itemCount: months.length,
              itemBuilder: (context, index) {
                final month = months[index];
                final visitData = _getMonthVisits(month, provider.timesheets);
                final hasVisits = visitData['count'] > 0;
                final isCurrent = _isCurrentMonth(month);

                return GestureDetector(
                  onTap: () => onMonthTap(month),
                  child: Container(
                    decoration: BoxDecoration(
                      color: hasVisits
                          ? theme.colorScheme.primary.withOpacity(0.15)
                          : theme.cardTheme.color ?? Colors.grey[50],
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isCurrent
                            ? theme.colorScheme.primary.withOpacity(0.5)
                            : theme.dividerColor.withOpacity(0.7),
                        width: isCurrent ? 1.5 : 1,
                      ),
                    ),
                    padding: const EdgeInsets.all(6),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          DateFormat('MMM').format(month),
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: hasVisits
                                ? theme.colorScheme.primary
                                : theme.colorScheme.onSurface,
                            fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          hasVisits
                              ? '${visitData['count']} visit${visitData['count'] > 1 ? 's' : ''}'
                              : 'No visits',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: hasVisits
                                ? theme.colorScheme.primary.withOpacity(0.8)
                                : theme.colorScheme.onSurface.withOpacity(0.5),
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
              decoration: BoxDecoration(
                color: theme.cardTheme.color ?? Colors.grey,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: theme.dividerColor.withOpacity(0.3)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Total Visits in ${date.year}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurface.withOpacity(0.8),
                    ),
                  ),
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
}