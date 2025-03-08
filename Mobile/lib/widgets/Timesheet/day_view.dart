import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/timesheet.dart';
import '../../models/visit.dart';
import '../../providers/timesheet_provider.dart';
import '../../widgets/Visit/visit_item.dart';

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
        if (visits.isEmpty) {
          return Center(child: Text('No visits scheduled for this day'));
        }
        return ListView.builder(
          shrinkWrap: true,
          physics: NeverScrollableScrollPhysics(),
          itemCount: visits.length,
          itemBuilder: (context, index) {
            final visit = visits[index];
            return VisitItem(
              visit,
              key: ValueKey(visit.visitID),
            );
          },
        );
      },
    );
  }
}