import 'package:flutter/material.dart';
import '../../models/timesheet.dart';
import '../../widgets/Visit/visit_item.dart';

class TimesheetDetails extends StatelessWidget {
  const TimesheetDetails({super.key});

  @override
  Widget build(BuildContext context) {
    final timesheet = ModalRoute.of(context)?.settings.arguments as Timesheet;

    return Scaffold(
      appBar: PreferredSize(
        preferredSize: Size.fromHeight(80),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF4CB1C7), Color(0xFF64C9D1)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
          ),
          child: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            title: Text(
              'Timesheet Visits',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            centerTitle: true,
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Section Title
            Text(
              'Week ${timesheet.weekNumber}, ${timesheet.year}',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFF4CB1C7)),
            ),
            SizedBox(height: 20),

            // Visits List
            Expanded(
              child: timesheet.visits!.isEmpty
                  ? Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.event_busy,
                      size: 80,
                      color: Colors.grey[400],
                    ),
                    SizedBox(height: 16),
                    Text(
                      'No Visits Found',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w500, color: Colors.grey[600]),
                      textAlign: TextAlign.center,
                    ),
                  ],
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
      ),
    );
  }
}