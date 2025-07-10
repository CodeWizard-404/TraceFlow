import 'package:TraceFlow/providers/location_provider.dart';
import 'package:TraceFlow/screens/Auth/ProfileScreen.dart';
import 'package:TraceFlow/screens/Auth/Verify2FAScreen.dart';
import 'package:TraceFlow/screens/Auth/forgot_password_screen.dart';
import 'package:TraceFlow/screens/Auth/verify_reset_screen.dart';
import 'package:TraceFlow/screens/Dashboard.dart';
import 'package:TraceFlow/screens/MapScreen.dart';
import 'package:TraceFlow/widgets/appbar/nav_bar.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:TraceFlow/providers/auth_provider.dart';
import 'package:TraceFlow/providers/notification_provider.dart';
import 'package:TraceFlow/screens/auth/login_screen.dart';
import 'package:TraceFlow/screens/timesheet/timesheet_details.dart';
import 'package:TraceFlow/screens/receipt/receipt_books.dart';
import 'package:TraceFlow/screens/receipt/transfer_receipt_book.dart';
import 'package:TraceFlow/screens/error.dart';
import 'package:TraceFlow/providers/agent_provider.dart';
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
import 'package:TraceFlow/themes/app_themes.dart';
import 'package:logging/logging.dart';

// Navigation service for global navigator access
class NavigationService {
  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>(debugLabel: 'MainNavigator');
  static final RouteObserver<ModalRoute> routeObserver = RouteObserver<ModalRoute>();
}

void configureLogging() {
  Logger.root.level = Level.WARNING; // Suppress logs below WARNING
  Logger.root.onRecord.listen((record) {
    print('${record.level.name}: ${record.time}: ${record.message}');
  });
}

void main() {
  debugPrint = (String? message, {int? wrapWidth}) {
    if (message != null && (message.contains("EGL_emulation") || message.contains("libEGL"))) return;
  };
  configureLogging();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AgentProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
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
        ChangeNotifierProvider(create: (_) => LocationProvider()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  MyAppState createState() => MyAppState();
}

class MyAppState extends State<MyApp> with RouteAware {
  int _selectedIndex = 0;
  String _currentRoute = '/timesheet-details';
  static const List<String> _mainRoutes = [
    '/timesheet-details',
    '/receipt-books',
    '/profile',
    '/supervisor-dashboard',
  ];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final modalRoute = ModalRoute.of(context);
    if (modalRoute != null) {
      NavigationService.routeObserver.subscribe(this, modalRoute);
    }
  }

  @override
  void dispose() {
    NavigationService.routeObserver.unsubscribe(this);
    super.dispose();
  }

  @override
  void didPush() {
    _updateIndexForRoute(ModalRoute.of(context)?.settings.name);
  }

  @override
  void didPopNext() {
    _updateIndexForRoute(ModalRoute.of(context)?.settings.name);
  }

  void _onItemTapped(int index) {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (authProvider.user == null && _mainRoutes.contains(_mainRoutes[index])) {
      return;
    }
    final targetRoute = _mainRoutes[index];
    if (_selectedIndex != index || _currentRoute != targetRoute) {
      setState(() {
        _selectedIndex = index;
        _currentRoute = targetRoute;
      });
      NavigationService.navigatorKey.currentState?.pushReplacementNamed(targetRoute);
    }
  }

  void _updateIndexForRoute(String? route) {
    if (route == null) return;
    setState(() {
      _currentRoute = route;
      final routeIndex = _mainRoutes.indexOf(route);
      if (routeIndex >= 0) {
        _selectedIndex = routeIndex;
      } else if (route == '/transfer-receipt-books') {
        _selectedIndex = 1;
      } else if (route == '/supervisor-dashboard') {
        _selectedIndex = 3;
      } else {
        _selectedIndex = 0;
      }
    });
  }

  bool _isAuthScreen(String routeName) {
    return [
      '/login',
      '/verify-2fa',
      '/forgot-password',
      '/reset-password',
    ].contains(routeName);
  }

  Widget _buildPage(BuildContext context, String routeName) {
    final authProvider = Provider.of<AuthProvider>(context);
    final notificationProvider = Provider.of<NotificationProvider>(context, listen: false);

    // Directly render auth screens without loading state
    if (_isAuthScreen(routeName)) {
      switch (routeName) {
        case '/login':
          return const LoginScreen();
        case '/verify-2fa':
          return const Verify2FAScreen();
        case '/forgot-password':
          return const ForgotPasswordScreen();
        case '/reset-password':
          return const VerifyResetScreen();
        default:
          return const LoginScreen();
      }
    }

    // Handle unauthenticated state
    if (authProvider.user == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _currentRoute == '/login') return;
        _updateIndexForRoute('/login');
        NavigationService.navigatorKey.currentState?.pushReplacementNamed('/login');
      });
      return const LoginScreen();
    }

    // Handle session expiration
    if (authProvider.errorMessage?.contains('Session expired') ?? false) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _currentRoute == '/login') return;
        _updateIndexForRoute('/login');
        NavigationService.navigatorKey.currentState?.pushReplacementNamed('/login');
      });
      return const LoginScreen();
    }

    // Handle 2FA requirement
    if (authProvider.requires2FA && routeName != '/verify-2fa') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _currentRoute == '/verify-2fa') return;
        _updateIndexForRoute('/verify-2fa');
        NavigationService.navigatorKey.currentState?.pushReplacementNamed('/verify-2fa');
      });
      return const Verify2FAScreen();
    }

    // Handle reset password requirement
    if (authProvider.user == null && authProvider.userID != null && routeName != '/reset-password') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _currentRoute == '/reset-password') return;
        _updateIndexForRoute('/reset-password');
        NavigationService.navigatorKey.currentState?.pushReplacementNamed('/reset-password');
      });
      return const VerifyResetScreen();
    }

    // Show loading only for protected routes during initial load
    if (authProvider.isLoading || !authProvider.permissionsLoaded) {
      return Scaffold(
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    // Initialize notifications for authenticated user
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      notificationProvider.initialize(
        authProvider.user!.userID,
        authProvider.userRoles ?? [],
      );
    });

    // Build the page with BottomNavBar for non-auth screens
    Widget page;
    switch (routeName) {
      case '/':
      case '/timesheet-details':
        page = const TimesheetDetailsScreen();
        break;
      case '/receipt-books':
        page = const ReceiptBooksScreen();
        break;
      case '/profile':
        page = const ProfileScreen();
        break;
      case '/transfer-receipt-books':
        page = const TransferReceiptBookScreen();
        break;
      case '/supervisor-dashboard':
        page = const SupervisorDashboard();
        break;
      default:
        page = ErrorPage(
          errorMessage: 'Page not found: $routeName',
          onRetry: () {
            _updateIndexForRoute('/timesheet-details');
            NavigationService.navigatorKey.currentState?.pushReplacementNamed('/timesheet-details');
          },
        );
    }

    return Scaffold(
      body: SafeArea(
        bottom: true,
        child: page,
      ),
      backgroundColor: Colors.transparent, // Make Scaffold background transparent
      /* Commented out to hide Bottom App Bar from UI
      bottomNavigationBar: Container(
        color: Colors.transparent, // Ensure BottomNavBar container is transparent
        child: BottomNavBar(
          currentIndex: _selectedIndex,
          onTap: _onItemTapped,
        ),
      ),
      */
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<ThemeProvider>(
      builder: (context, themeProvider, child) {
        if (kDebugMode) print('MyApp build');
        return MaterialApp(
          title: 'TraceFlow',
          theme: AppThemes.lightTheme,
          darkTheme: AppThemes.darkTheme,
          themeMode: themeProvider.themeMode,
          navigatorKey: NavigationService.navigatorKey,
          navigatorObservers: [NavigationService.routeObserver, RouteLogger()],
          initialRoute: '/login', // Start at login to avoid protected routes
          onGenerateRoute: (settings) {
            return MaterialPageRoute(
              builder: (context) => _buildPage(context, settings.name ?? '/login'),
              settings: settings,
            );
          },
        );
      },
    );
  }
}

class RouteLogger extends NavigatorObserver {
  @override
  void didPush(Route route, Route? previousRoute) {
    if (kDebugMode) {
      print('Route pushed: ${route.settings.name}, Previous: ${previousRoute?.settings.name}');
    }
  }

  @override
  void didPop(Route route, Route? previousRoute) {
    if (kDebugMode) {
      print('Route popped: ${route.settings.name}, Previous: ${previousRoute?.settings.name}');
    }
  }

  @override
  void didReplace({Route? newRoute, Route? oldRoute}) {
    if (kDebugMode) {
      print('Route replaced: ${newRoute?.settings.name}, Old: ${oldRoute?.settings.name}');
    }
  }

  @override
  void didRemove(Route route, Route? previousRoute) {
    if (kDebugMode) {
      print('Route removed: ${route.settings.name}, Previous: ${previousRoute?.settings.name}');
    }
  }
}