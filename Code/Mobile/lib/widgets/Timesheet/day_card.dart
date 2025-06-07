import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../models/visit.dart';
import '../../providers/visit_provider.dart';
import '../../providers/timesheet_provider.dart';
import '../../providers/auth_provider.dart';
import 'day_view.dart';

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
    return Consumer2<TimesheetProvider, VisitProvider>(
      builder: (context, timesheetProvider, visitProvider, child) {
        final authProvider = Provider.of<AuthProvider>(context, listen: false);

        return DragTarget<Visit>(
          onWillAccept: (data) {
            // Prevent dropping on days before today
            final today = DateTime.now();
            final targetDate = DateTime(day.year, day.month, day.day);
            final todayDate = DateTime(today.year, today.month, today.day);
            return !targetDate.isBefore(todayDate);
          },
          onAcceptWithDetails: (details) {
            final droppedVisit = details.data;
            final newDate = DateFormat('yyyy-MM-dd').format(day);
            if (droppedVisit.date != day) {
              visitProvider
                  .updateVisit(
                visitId: droppedVisit.visitID,
                date: newDate,
                time: droppedVisit.time,
                status: 'pending',
              )
                  .then((_) {
                timesheetProvider.fetchTimesheetsBySupervisor(authProvider.user!.userID!);
              })
                  .catchError((error) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Failed to move visit: $error')),
                );
              });
            }
          },
          builder: (context, candidateData, rejectedData) {
            return GestureDetector(
              onTap: onTap,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeInOut,
                decoration: BoxDecoration(
                  color: candidateData.isNotEmpty ? theme.colorScheme.primary.withOpacity(0.1) : null,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Card(
                  elevation: 5,
                  color: theme.cardTheme.color,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              title,
                              style: theme.textTheme.headlineSmall,
                            ),
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
                          ],
                        ),
                      ),
                      DayView(day),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}