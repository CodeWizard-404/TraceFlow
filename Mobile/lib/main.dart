import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:TraceFlow/providers/agent_provider.dart';
import 'package:TraceFlow/providers/auth_provider.dart';
import 'package:TraceFlow/providers/checklist_provider.dart';
import 'package:TraceFlow/providers/reason_provider.dart';
import 'package:TraceFlow/providers/receipt_book_provider.dart';
import 'package:TraceFlow/providers/receipt_stub_provider.dart';
import 'package:TraceFlow/providers/timesheet_provider.dart';
import 'package:TraceFlow/providers/visit_provider.dart';
import 'package:TraceFlow/providers/user_provider.dart';
import 'package:TraceFlow/providers/role_provider.dart';
import 'package:TraceFlow/providers/permission_provider.dart';
import 'package:TraceFlow/providers/theme_provider.dart';
import 'package:TraceFlow/screens/Timesheet/Timesheet_details.dart';
import 'package:TraceFlow/screens/Auth/login_screen.dart';
import 'package:TraceFlow/screens/Error.dart';
import 'themes/app_themes.dart';

void main() {
  // Custom debug print to filter out unwanted logs
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
        ChangeNotifierProvider(create: (_) => AgentProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => ChecklistProvider()),
        ChangeNotifierProvider(create: (_) => ReasonProvider()),
        ChangeNotifierProvider(create: (_) => ReceiptBookProvider()),
        ChangeNotifierProvider(create: (_) => ReceiptStubProvider()),
        ChangeNotifierProvider(create: (_) => TimesheetProvider()),
        ChangeNotifierProvider(create: (_) => VisitProvider()),
        ChangeNotifierProvider(create: (_) => UserProvider()),
        ChangeNotifierProvider(create: (_) => RoleProvider()),
        ChangeNotifierProvider(create: (_) => PermissionProvider()),
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
          theme: AppThemes.lightTheme,
          darkTheme: AppThemes.darkTheme,
          themeMode: themeProvider.themeMode,
          home: Consumer<AuthProvider>(
            builder: (context, authProvider, child) {
              // If no token, show login screen; otherwise, show timesheet details
              return authProvider.token == null
                  ? const LoginScreen()
                  : const TimesheetDetailsScreen();
            },
          ),
          routes: {
            '/login': (context) => const LoginScreen(),
            '/timesheet-details': (context) => const TimesheetDetailsScreen(),
          },
          onUnknownRoute: (settings) {
            return MaterialPageRoute(
              builder: (context) => ErrorPage(
                errorMessage: 'Page not found: ${settings.name}. Please try again.',
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