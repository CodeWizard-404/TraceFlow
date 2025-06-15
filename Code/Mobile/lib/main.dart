import 'package:TraceFlow/providers/location_provider.dart';
import 'package:TraceFlow/screens/Auth/ProfileScreen.dart';
import 'package:TraceFlow/screens/Auth/Verify2FAScreen.dart';
import 'package:TraceFlow/screens/Auth/forgot_password_screen.dart';
import 'package:TraceFlow/screens/Auth/verify_reset_screen.dart';
import 'package:TraceFlow/screens/Dashboard.dart';
import 'package:TraceFlow/screens/MapScreen.dart';
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
  // Suppress specific debug logs
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

class MyApp extends StatelessWidget {
  const MyApp({super.key});

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
          home: const AuthWrapper(),
          navigatorKey: NavigationService.navigatorKey,
          navigatorObservers: [NavigationService.routeObserver, RouteLogger()],
          routes: {
            '/login': (_) => const LoginScreen(),
            '/verify-2fa': (_) => const Verify2FAScreen(),
            '/forgot-password': (_) => const ForgotPasswordScreen(),
            '/reset-password': (_) => const VerifyResetScreen(),
            '/timesheet-details': (_) => const TimesheetDetailsScreen(),
            '/receipt-books': (_) => const ReceiptBooksScreen(),
            '/profile': (_) => const ProfileScreen(),
            '/transfer-receipt-books': (_) => const TransferReceiptBookScreen(),
            '/map': (_) => const MapScreen(),
            '/supervisor-dashboard': (_) => const SupervisorDashboard(),
          },
          onGenerateRoute: (settings) {
            return MaterialPageRoute(
              builder: (context) => ErrorPage(
                errorMessage: 'Page not found: ${settings.name}',
                onRetry: () {
                  NavigationService.navigatorKey.currentState?.pushReplacementNamed('/timesheet-details');
                },
              ),
              settings: settings,
            );
          },
        );
      },
    );
  }
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  AuthWrapperState createState() => AuthWrapperState();
}

class AuthWrapperState extends State<AuthWrapper> {
  String? _lastPushedRoute; // Track last pushed route to prevent duplicates

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final notificationProvider = Provider.of<NotificationProvider>(context, listen: false);

    if (kDebugMode) {
      print('AuthWrapper build: user=${authProvider.user?.userID}, '
          'isLoading=${authProvider.isLoading}, '
          'isSupervisor=${authProvider.isSupervisor}, '
          'requires2FA=${authProvider.requires2FA}, '
          'permissionsLoaded=${authProvider.permissionsLoaded}, '
          'userID=${authProvider.userID}');
    }

    if (authProvider.isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (authProvider.errorMessage?.contains('Session expired') ?? false) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        if (ModalRoute.of(context)?.settings.name != '/login' && _lastPushedRoute != '/login') {
          _lastPushedRoute = '/login';
          NavigationService.navigatorKey.currentState?.pushReplacementNamed('/login');
        }
      });
      return const SizedBox.shrink();
    }

    if (authProvider.requires2FA) {
      return const Verify2FAScreen();
    }

    // Handle password reset flow
    if (authProvider.user == null && authProvider.userID != null) {
      final currentRoute = ModalRoute.of(context)?.settings.name;
      if (currentRoute != '/reset-password' && _lastPushedRoute != '/reset-password') {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          _lastPushedRoute = '/reset-password';
          NavigationService.navigatorKey.currentState?.pushNamed('/reset-password');
        });
      }
      return const VerifyResetScreen();
    }

    if (authProvider.user == null) {
      final currentRoute = ModalRoute.of(context)?.settings.name;
      if (currentRoute != '/login' && _lastPushedRoute != '/login') {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          _lastPushedRoute = '/login';
          NavigationService.navigatorKey.currentState?.pushReplacementNamed('/login');
        });
      }
      return const LoginScreen();
    }

    if (!authProvider.permissionsLoaded) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    // Initialize notifications for authenticated Supervisor
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      notificationProvider.initialize(
        authProvider.user!.userID,
        authProvider.userRoles ?? [],
      );
    });

    return const NavigationShell();
  }
}



class NavigationShell extends StatefulWidget {
  const NavigationShell({super.key});

  @override
  NavigationShellState createState() => NavigationShellState();
}

class NavigationShellState extends State<NavigationShell> with RouteAware {
  int _selectedIndex = 0;
  String _currentRoute = '/timesheet-details';
  static const List<String> _mainRoutes = [
    '/timesheet-details',
    '/receipt-books',
    '/profile',
    '/map',
  ];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    NavigationService.routeObserver.subscribe(this, ModalRoute.of(context)!);
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
      } else {
        _selectedIndex = 0;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final showBottomNav = !['/login', '/verify-2fa'].contains(_currentRoute);

    return Scaffold(
      body: const RouterOutlet(),
      bottomNavigationBar: showBottomNav
          ? BottomNavBar(
        currentIndex: _selectedIndex,
        onTap: _onItemTapped,
      )
          : null,
    );
  }
}

class RouterOutlet extends StatelessWidget {
  const RouterOutlet({super.key});

  @override
  Widget build(BuildContext context) {
    return Navigator(
      initialRoute: '/timesheet-details',
      onGenerateRoute: (settings) {
        Widget page;
        String routeName = settings.name ?? '/timesheet-details';
        if (routeName == '/') routeName = '/timesheet-details';
        switch (routeName) {
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
            case '/map':
            page = const MapScreen();
            break;
            case '/supervisor-dashboard':
            page = const SupervisorDashboard();
            break;
          default:
            page = ErrorPage(
              errorMessage: 'Page not found: $routeName',
              onRetry: () {
                NavigationService.navigatorKey.currentState?.pushReplacementNamed('/timesheet-details');
              },
            );
        }
        return MaterialPageRoute(
          builder: (context) => page,
          settings: RouteSettings(name: routeName),
        );
      },
    );
  }
}

class BottomNavBar extends StatelessWidget {
  final int currentIndex;
  final Function(int) onTap;

  const BottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        boxShadow: [
          BoxShadow(
            color: theme.dividerColor.withOpacity(0.2),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: BottomNavigationBar(
        currentIndex: currentIndex,
        onTap: onTap,
        backgroundColor: theme.scaffoldBackgroundColor,
        selectedItemColor: theme.colorScheme.primary,
        unselectedItemColor: theme.colorScheme.secondary,
        showUnselectedLabels: true,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: const TextStyle(
          fontFamily: 'Inter',
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
        unselectedLabelStyle: const TextStyle(
          fontFamily: 'Inter',
          fontWeight: FontWeight.w400,
          fontSize: 12,
        ),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.schedule, size: 24),
            label: 'Timesheet',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.receipt_long_rounded, size: 24),
            label: 'Receipts',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person, size: 24),
            label: 'Profile',
          ),
        ],
      ),
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