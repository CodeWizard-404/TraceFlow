import 'package:flutter/material.dart';
import '../models/timesheet.dart';

class TimesheetItem extends StatelessWidget {
  final Timesheet timesheet;

  const TimesheetItem(this.timesheet, {super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text('Week ${timesheet.weekNumber}, ${timesheet.year}'),
        subtitle: Text('Status: ${timesheet.status}'),
        onTap: () => Navigator.pushNamed(context, '/timesheet-details', arguments: timesheet),
      ),
    );
  }
}