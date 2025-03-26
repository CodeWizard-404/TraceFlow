// lib/main.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:TraceFlow/providers/agent_provider.dart';
import 'package:TraceFlow/providers/checklist_provider.dart';
import 'package:TraceFlow/providers/reason_provider.dart';
import 'package:TraceFlow/providers/timesheet_provider.dart';
import 'package:TraceFlow/providers/visit_provider.dart';
import 'package:TraceFlow/providers/theme_provider.dart';
import 'package:TraceFlow/screens/Timesheet/Timesheet_details.dart';
import 'package:TraceFlow/screens/Error.dart';
import 'themes/app_themes.dart';

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
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<ThemeProvider>(
      builder: (context, themeProvider, child) {
        return MaterialApp(
          title: 'TraceFlow',
          theme: AppThemes.lightTheme, // Define light theme
          darkTheme: AppThemes.darkTheme, // Define dark theme
          themeMode: themeProvider.themeMode, // Use ThemeMode from provider
          home: const HomeScreen(),
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
      },
    );
  }
}