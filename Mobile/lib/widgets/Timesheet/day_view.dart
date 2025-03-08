import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/timesheet.dart';
import '../../models/visit.dart';
import '../../providers/timesheet_provider.dart';
import '../Visit/visit_item.dart';

class DayView extends StatelessWidget {
  final DateTime day;

  const DayView(this.day, {super.key});

  List<Visit> getVisitsForDay(DateTime day, List<Timesheet> timesheets) {
    final localDayStart = DateTime(day.year, day.month, day.day);
    final allVisits = timesheets
        .expand((timesheet) => timesheet.visits ?? [])
        .where((visit) {
      final visitDate = visit.date != null
          ? DateTime(
        visit.date!.toLocal().year,
        visit.date!.toLocal().month,
        visit.date!.toLocal().day,
      )
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
    return Consumer<TimesheetProvider>(
      builder: (context, provider, child) {
        final visits = getVisitsForDay(day, provider.timesheets);
        return SingleChildScrollView( // Added scroll view
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16), // Adjusted padding
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (visits.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFF4CB1C7).withOpacity(0.1),
                          ),
                          child: const Icon(
                            Icons.event_busy,
                            size: 20,
                            color: Color(0xFF4CB1C7),
                          ),
                        ),
                        Text(
                          'No visits scheduled',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey[600],
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  ...visits.map((visit) => VisitItem(visit)).toList(),
              ],
            ),
          ),
        );
      },
    );
  }
}