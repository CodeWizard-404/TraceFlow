import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/timesheet_provider.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final timesheetProvider = Provider.of<TimesheetProvider>(context);
    final currentTimesheet = timesheetProvider.currentTimesheet;

    return Scaffold(
      appBar: AppBar(title: Text('Supervisor Home')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            if (currentTimesheet != null)
              Card(
                child: ListTile(
                  title: Text('Current Timesheet: Week ${currentTimesheet.weekNumber}, ${currentTimesheet.year}'),
                  subtitle: Text('Status: ${currentTimesheet.status}'),
                  onTap: () => Navigator.pushNamed(context, '/timesheet-details', arguments: currentTimesheet),
                ),
              ),
            SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => Navigator.pushNamed(context, '/log-visit'),
              child: Text('Log New Visit'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pushNamed(context, '/manage-timesheets'),
              child: Text('Manage Timesheets'),
            ),
          ],
        ),
      ),
    );
  }
}