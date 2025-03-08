import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:visit_management/providers/agent_provider.dart';
import 'package:visit_management/providers/checklist_provider.dart';
import 'package:visit_management/providers/reason_provider.dart';
import 'package:visit_management/screens/Error.dart';

import 'providers/timesheet_provider.dart';
import 'providers/visit_provider.dart';
import 'screens/Timesheet/Timesheet_details.dart';

void main() {
  debugPrint = (String? message, {int? wrapWidth}) {
    if (message != null &&
        (message.contains("EGL_emulation") || message.contains("libEGL"))) {
      return;
    }
    print(message);
  };

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => TimesheetProvider()),
        ChangeNotifierProvider(create: (_) => VisitProvider()),
        ChangeNotifierProvider(create: (_) => AgentProvider()),
        ChangeNotifierProvider(create: (_) => ChecklistProvider()),
        ChangeNotifierProvider(create: (_) => ReasonProvider()),
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