import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/timesheet_provider.dart';
import '../widgets/timesheet_item.dart';

class ManageTimesheetsScreen extends StatefulWidget {
  const ManageTimesheetsScreen({Key? key}) : super(key: key);

  @override
  _ManageTimesheetsScreenState createState() => _ManageTimesheetsScreenState();
}

class _ManageTimesheetsScreenState extends State<ManageTimesheetsScreen> {
  late Future<void> _timesheetsFuture;

  @override
  void initState() {
    super.initState();
    // Using listen: false because we don't need rebuilds here when fetching
    final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);
    _timesheetsFuture = timesheetProvider.fetchTimesheets();
  }

  // Method to refresh timesheets if needed (e.g., on Retry)
  Future<void> _refreshTimesheets() async {
    final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);
    setState(() {
      _timesheetsFuture = timesheetProvider.fetchTimesheets();
    });
  }

  @override
  Widget build(BuildContext context) {
    final timesheetProvider = Provider.of<TimesheetProvider>(context);
    return Scaffold(
      appBar: AppBar(
        title: Text('Manage Timesheets'),
      ),
      body: FutureBuilder(
        future: _timesheetsFuture,
        builder: (ctx, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            // Show a loading indicator while fetching data
            return Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            // Handle errors during the API call
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('Failed to load timesheets'),
                  ElevatedButton(
                    onPressed: _refreshTimesheets,
                    child: Text('Retry'),
                  ),
                ],
              ),
            );
          } else if (timesheetProvider.timesheets.isEmpty) {
            // Handle the case where no timesheets are available
            return Center(
              child: Text('No timesheets available'),
            );
          } else {
            // Display the list of timesheets
            return ListView.builder(
              itemCount: timesheetProvider.timesheets.length,
              itemBuilder: (ctx, i) => TimesheetItem(
                timesheetProvider.timesheets[i],
              ),
            );
          }
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // Navigate to the screen for creating a new timesheet
          Navigator.pushNamed(context, '/create-timesheet');
        },
        child: Icon(Icons.add),
      ),
    );
  }
}
