import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:visit_management/providers/agent_provider.dart';
import 'package:visit_management/screens/Error.dart';

import 'package:visit_management/screens/timesheet_details.dart';
import 'providers/timesheet_provider.dart';
import 'providers/visit_provider.dart';
import 'screens/home_screen.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => TimesheetProvider()),
        ChangeNotifierProvider(create: (_) => VisitProvider()),
        ChangeNotifierProvider(create: (_) => AgentProvider()),

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
        '/timesheet-details': (_) => TimesheetDetails(),
        '/log-visit': (_) {
          throw Exception('LogVisitScreen requires weekNumber and year parameters.');
        },

      },
      onUnknownRoute: (settings) {
        return MaterialPageRoute(
          builder: (context) => ErrorPage(
            errorMessage: 'Page not found. Please try again.',
            onRetry: () {
              Navigator.pop(context);
            },
          ),
        );
      },
    );
  }
}