import 'package:TraceFlow/screens/Auth/Verify2FAScreen.dart';
import 'package:TraceFlow/screens/Receipt/receipt_books.dart';
import 'package:TraceFlow/screens/Receipt/transfer_receipt_book.dart';
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
  debugPrint = (String? message, {int? wrapWidth}) {
    if (message != null && (message.contains("EGL_emulation") || message.contains("libEGL"))) {
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

  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  @override
  Widget build(BuildContext context) {
    return Consumer<ThemeProvider>(
      builder: (context, themeProvider, child) {
        debugPrint('MyApp build called');
        return MaterialApp(
          title: 'TraceFlow',
          theme: AppThemes.lightTheme,
          darkTheme: AppThemes.darkTheme,
          themeMode: themeProvider.themeMode,
          navigatorKey: navigatorKey,
          home: const AuthWrapper(),
          routes: {
            '/login': (context) => const LoginScreen(),
            '/timesheet-details': (context) => const TimesheetDetailsScreen(),
            '/receipt-books': (context) => const ReceiptBooksScreen(),
            '/transfer-receipt-books': (context) => const TransferReceiptBookScreen(),
            '/verify-2fa': (context) => const Verify2FAScreen(),
          },
          onUnknownRoute: (settings) {
            debugPrint('Unknown route: ${settings.name}');
            return MaterialPageRoute(
              builder: (context) => ErrorPage(
                errorMessage: 'Page not found: ${settings.name}. Please try again.',
                onRetry: () {
                  Navigator.pop(context);
                },
              ),
            );
          },
          navigatorObservers: [RouteLogger()],
        );
      },
    );
  }
}

class AuthWrapper extends StatelessWidget {
  const AuthWrapper({super.key});

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    debugPrint('AuthWrapper build: token=${authProvider.token}, isLoading=${authProvider.isLoading}, isSupervisor=${authProvider.isSupervisor}, requires2FA=${authProvider.requires2FA}');

    // Show loading screen while auth data is being processed
    if (authProvider.isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    // If 2FA is required, show Verify2FAScreen
    if (authProvider.requires2FA) {
      debugPrint('AuthWrapper: Returning Verify2FAScreen');
      return const Verify2FAScreen();
    }

    // If no token or user, show login screen
    if (authProvider.token == null || authProvider.user == null) {
      debugPrint('AuthWrapper: Returning LoginScreen');
      return const LoginScreen();
    }

    // If token exists and user is a Supervisor, show home page
    if (authProvider.isSupervisor) {
      debugPrint('AuthWrapper: Returning TimesheetDetailsScreen');
      return const TimesheetDetailsScreen();
    }

    // If token exists but user isn’t a Supervisor, logout and show login
    debugPrint('Clearing invalid state: non-Supervisor with token');
    authProvider.logout();
    return const LoginScreen();
  }
}

class RouteLogger extends NavigatorObserver {
  @override
  void didPush(Route route, Route? previousRoute) {
    debugPrint('Route pushed: ${route.settings.name ?? route.runtimeType}, Previous: ${previousRoute?.settings.name ?? previousRoute?.runtimeType}');
  }

  @override
  void didPop(Route route, Route? previousRoute) {
    debugPrint('Route popped: ${route.settings.name ?? route.runtimeType}, Previous: ${previousRoute?.settings.name ?? previousRoute?.runtimeType}');
  }

  @override
  void didReplace({Route? newRoute, Route? oldRoute}) {
    debugPrint('Route replaced: ${newRoute?.settings.name ?? newRoute?.runtimeType}, Old: ${oldRoute?.settings.name ?? oldRoute?.runtimeType}');
  }

  @override
  void didRemove(Route route, Route? previousRoute) {
    debugPrint('Route removed: ${route.settings.name ?? route.runtimeType}, Previous: ${previousRoute?.settings.name ?? previousRoute?.runtimeType}');
  }
}