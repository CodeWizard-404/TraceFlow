import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:visit_management/screens/create_timesheet_screen.dart';
import 'package:visit_management/screens/log_visit_screen.dart';
import 'package:visit_management/screens/manage_timesheets_screen.dart';
import 'package:visit_management/screens/timesheet_details_screen.dart';
import 'providers/timesheet_provider.dart';
import 'providers/visit_provider.dart';
import 'screens/home_screen.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => TimesheetProvider()),
        ChangeNotifierProvider(create: (_) => VisitProvider()),
      ],
      child: MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Timesheet App',
      home: HomeScreen(),
      routes: {
        '/manage-timesheets': (_) => ManageTimesheetsScreen(),
        '/create-timesheet': (_) => CreateTimesheetScreen(),
        '/timesheet-details': (_) => TimesheetDetailsScreen(),
        '/log-visit': (_) => LogVisitScreen(),
      },
    );
  }
}