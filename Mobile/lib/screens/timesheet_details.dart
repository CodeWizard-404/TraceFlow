import 'package:flutter/material.dart';
import '../models/timesheet.dart';
import '../widgets/visit_item.dart';

class TimesheetDetails extends StatelessWidget {
  const TimesheetDetails({super.key});

  @override
  Widget build(BuildContext context) {
    final timesheet = ModalRoute.of(context)?.settings.arguments as Timesheet;

    return Scaffold(
      appBar: AppBar(title: const Text('Timesheet Visits')),
      body: Column(
        children: [
          Expanded(
            child: timesheet.visits!.isEmpty
                ? const Center(
              child: Text(
                'No Visits Found',
                style: TextStyle(fontSize: 18, color: Colors.grey),
              ),
            )
                : ListView.builder(
              itemCount: timesheet.visits?.length,
              itemBuilder: (ctx, index) {
                final visit = timesheet.visits?[index];
                return VisitItem(visit!);
              },
            ),
          ),
        ],
      ),
    );
  }
}