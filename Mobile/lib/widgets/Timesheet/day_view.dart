import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/timesheet.dart';
import '../../providers/timesheet_provider.dart';
import '../Visit/visit_item.dart';
import '../commen/empty_state.dart';

class DayView extends StatelessWidget {
  final DateTime day;

  const DayView(this.day, {super.key});

  List getVisitsForDay(DateTime day, List<Timesheet> timesheets) {
    final localDayStart = DateTime(day.year, day.month, day.day);
    final allVisits = timesheets
        .expand((timesheet) => timesheet.visits ?? [])
        .where((visit) {
      final visitDate = visit.date != null
          ? DateTime(visit.date!.year, visit.date!.month, visit.date!.day)
          : null;
      return visitDate != null && visitDate.isAtSameMomentAs(localDayStart);
    }).toList();

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
        return visits.isEmpty
            ? const Padding(
          padding: EdgeInsets.symmetric(vertical: 16),
          child: EmptyState(text: 'No visits scheduled'),
        )
            : ListView.separated(
          shrinkWrap: true,
          physics: NeverScrollableScrollPhysics(), // Disables internal scrolling

          itemCount: visits.length,
          separatorBuilder: (context, index) => const SizedBox(height: 0),
          itemBuilder: (context, index) => AnimatedOpacity(
            opacity: 1.0,
            duration: const Duration(milliseconds: 300),
            child: VisitItem(visits[index]),
          ),
        );
      },
    );
  }
}