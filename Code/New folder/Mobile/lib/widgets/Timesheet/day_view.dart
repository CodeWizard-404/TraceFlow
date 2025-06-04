import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../models/visit.dart';
import '../../models/timesheet.dart';
import '../../providers/timesheet_provider.dart';
import '../../providers/visit_provider.dart';
import '../../providers/auth_provider.dart';
import '../Visit/visit_item.dart';
import '../commen/empty_state.dart';

class DayView extends StatelessWidget {
  final DateTime day;

  const DayView(this.day, {super.key});

  List<Visit> getVisitsForDay(DateTime day, List<Timesheet> timesheets) {
    final localDayStart = DateTime(day.year, day.month, day.day);
    final allVisits = timesheets
        .expand((timesheet) => timesheet.visits ?? [])
        .where((visit) {
      final visitDate = visit.date != null
          ? DateTime(visit.date!.year, visit.date!.month, visit.date!.day)
          : null;
      return visitDate != null && visitDate.isAtSameMomentAs(localDayStart);
    })
        .toList()
        .cast<Visit>();

    allVisits.sort((a, b) {
      if (a.time == null && b.time == null) return 0;
      if (a.time == null) return 1;
      if (b.time == null) return -1;
      return a.time!.compareTo(b.time!);
    });

    return allVisits;
  }

  @override
  Widget build(BuildContext context) {
    return Consumer2<TimesheetProvider, VisitProvider>(
      builder: (context, timesheetProvider, visitProvider, child) {
        final visits = getVisitsForDay(day, timesheetProvider.timesheets);
        final authProvider = Provider.of<AuthProvider>(context, listen: false);

        if (visits.isEmpty) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: EmptyState(text: 'No visits scheduled'),
          );
        }

        return DragTarget<Visit>(
          onAcceptWithDetails: (details) {
            final droppedVisit = details.data;
            if (droppedVisit.date != day) {
              // Dropped on a different day; update date
              final newDate = DateFormat('yyyy-MM-dd').format(day);
              visitProvider
                  .updateVisit(
                visitId: droppedVisit.visitID,
                date: newDate,
                time: droppedVisit.time,
                status: 'pending', // Always set status to 'pending'
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
            return ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: visits.length,
              separatorBuilder: (context, index) => const SizedBox(height: 0),
              itemBuilder: (context, index) {
                final visit = visits[index];
                return DragTarget<Visit>(
                  onAcceptWithDetails: (details) {
                    final droppedVisit = details.data;
                    final newTime = visit.time;
                    if (droppedVisit.visitID != visit.visitID) {
                      // Reorder within the same day
                      visitProvider
                          .updateVisit(
                        visitId: droppedVisit.visitID,
                        time: newTime,
                        status: 'pending', // Always set status to 'pending'
                      )
                          .then((_) {
                        timesheetProvider.fetchTimesheetsBySupervisor(authProvider.user!.userID!);
                      })
                          .catchError((error) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Failed to reorder visit: $error')),
                        );
                      });
                    }
                  },
                  builder: (context, candidateData, rejectedData) {
                    return AnimatedOpacity(
                      opacity: candidateData.isNotEmpty ? 0.5 : 1.0,
                      duration: const Duration(milliseconds: 300),
                      child: VisitItem(visit: visit),
                    );
                  },
                );
              },
            );
          },
        );
      },
    );
  }
}