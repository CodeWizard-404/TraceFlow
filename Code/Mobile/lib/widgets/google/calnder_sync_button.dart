import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/timesheet_provider.dart';
import '../Timesheet/day_view.dart';

class DayCard extends StatelessWidget {
  final DateTime day;
  final String title;
  final String chipLabel;
  final VoidCallback? onTap;

  const DayCard({
    required this.day,
    required this.title,
    required this.chipLabel,
    this.onTap,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final authProvider = Provider.of<AuthProvider>(context);
    final isSupervisor = authProvider.user?.roles?.contains('SUPERVISOR') ?? false;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        child: Card(
          elevation: 5,
          color: theme.cardTheme.color,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      title,
                      style: theme.textTheme.headlineSmall,
                    ),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.onSurface.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            chipLabel,
                            style: TextStyle(
                              fontSize: 12,
                              color: theme.colorScheme.onSurface,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        if (isSupervisor) ...[
                          const SizedBox(width: 8),
                          IconButton(
                            icon: const Icon(Icons.calendar_today),
                            onPressed: () async {
                              final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);
                              await timesheetProvider.syncTimesheetToCalendar(
                                timesheetProvider.timesheets
                                    .firstWhere((ts) => ts.visits!.any((v) => v.date.day == day.day))
                                    .timesheetID,
                              );
                            },
                            tooltip: 'Sync to Calendar',
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              DayView(day),
            ],
          ),
        ),
      ),
    );
  }
}