
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:visit_management/widgets/Visit/visit_item.dart';
import '../../models/visit.dart';
import '../../providers/timesheet_provider.dart';

class DayView extends StatefulWidget {
  final DateTime day;

  const DayView(this.day, {super.key});

  @override
  _DayViewState createState() => _DayViewState();
}

class _DayViewState extends State<DayView> {
  Future<List<Visit>>? _visitsFuture;

  @override
  void initState() {
    super.initState();
    _visitsFuture = fetchVisitsForDay(widget.day);
  }

  Future<List<Visit>> fetchVisitsForDay(DateTime day) async {
    final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);

    // Fetch all timesheets
    await timesheetProvider.fetchTimesheets();

    // Convert the input day to local time (start of the day)
    final localDayStart = DateTime(day.year, day.month, day.day);

    // Filter visits for the given day
    final allVisits = timesheetProvider.timesheets
        .expand((timesheet) => timesheet.visits ?? [])
        .where((visit) {
      // Normalize visit.date to local time (start of the day)
      final visitDate = DateTime(
        visit.date!.toLocal().year,
        visit.date!.toLocal().month,
        visit.date!.toLocal().day,
      );
      return visitDate.isAtSameMomentAs(localDayStart);
    })
        .toList()
        .cast<Visit>();

    // Sort visits by time
    allVisits.sort((a, b) => a.time!.compareTo(b.time!));

    return allVisits;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FutureBuilder<List<Visit>>(
          future: _visitsFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return Center(child: CircularProgressIndicator());
            } else if (snapshot.hasError) {
              return Center(child: Text('Failed to load visits'));
            } else if (snapshot.data!.isEmpty) {
              return Center(child: Text('No visits scheduled for this day !!!'));
            } else {
              return ListView.builder(
                shrinkWrap: true,
                physics: NeverScrollableScrollPhysics(),
                itemCount: snapshot.data!.length,
                itemBuilder: (context, index) {
                  final visit = snapshot.data![index];
                  return VisitItem(visit);
                },
              );
            }
          },
        ),
      ],
    );
  }
}
