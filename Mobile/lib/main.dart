import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:TraceFlow/providers/auth_provider.dart';
import 'package:TraceFlow/screens/Auth/login_screen.dart';
import 'package:TraceFlow/screens/Auth/Verify2FAScreen.dart';
import 'package:TraceFlow/screens/Timesheet/Timesheet_details.dart';
import 'package:TraceFlow/screens/Receipt/receipt_books.dart';
import 'package:TraceFlow/screens/Receipt/transfer_receipt_book.dart';
import 'package:TraceFlow/screens/Error.dart';
import 'package:TraceFlow/screens/Auth/ProfileScreen.dart';
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

// NavigationService to provide global access to Navigator key
class NavigationService {
  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
  static final RouteObserver<ModalRoute> routeObserver = RouteObserver<ModalRoute>();
}

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
          home: const AuthWrapper(),
          navigatorObservers: [NavigationService.routeObserver, RouteLogger()],
        );
      },
    );
  }
}

class NavigationShell extends StatefulWidget {
  final Widget child;

  const NavigationShell({super.key, required this.child});

  @override
  _NavigationShellState createState() => _NavigationShellState();
}

class _NavigationShellState extends State<NavigationShell> with RouteAware {
  int _selectedIndex = 0;
  String _currentRoute = '/timesheet-details';
  static const List<String> _mainRoutes = [
    '/timesheet-details',
    '/receipt-books',
    '/profile',
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
    debugPrint('Tapped index: $index, target route: $targetRoute, current index: $_selectedIndex');
    if (_selectedIndex != index) {
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
        _selectedIndex = 1; // Receipts tab
      } else {
        _selectedIndex = 0; // Default to Timesheet
      }
    });
    debugPrint('Updated route: $_currentRoute, selected index: $_selectedIndex');
  }

  @override
  Widget build(BuildContext context) {
    final showBottomNav = !['/login', '/verify-2fa'].contains(_currentRoute);

    return Scaffold(
      body: widget.child,
      bottomNavigationBar: showBottomNav
          ? BottomNavBar(
        currentIndex: _selectedIndex,
        onTap: _onItemTapped,
      )
          : null,
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

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  _AuthWrapperState createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    debugPrint(
        'AuthWrapper build: '
            'user=${authProvider.user?.userID},'
            'isLoading=${authProvider.isLoading}, '
            'isSupervisor=${authProvider.isSupervisor}, '
            'requires2FA=${authProvider.requires2FA}, '
            'error=${authProvider.errorMessage}');

    if (authProvider.isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (authProvider.errorMessage?.contains('Session expired') ?? false) {
      debugPrint('AuthWrapper: Session expired, redirecting to LoginScreen');
      WidgetsBinding.instance.addPostFrameCallback((_) {
        NavigationService.navigatorKey.currentState?.pushReplacementNamed('/login');
      });
      return const SizedBox.shrink();
    }

    if (authProvider.requires2FA) {
      debugPrint('AuthWrapper: Returning Verify2FAScreen');
      return const Verify2FAScreen();
    }

    if (authProvider.user == null) {
      debugPrint('AuthWrapper: Returning LoginScreen');
      return const LoginScreen();
    }

    debugPrint('AuthWrapper: Returning NavigationShell');
    return NavigationShell(
      child: Navigator(
        key: NavigationService.navigatorKey,
        initialRoute: '/timesheet-details',
        onGenerateRoute: (settings) {
          Widget page;
          String routeName = settings.name ?? '/timesheet-details';
          if (routeName == '/') {
            routeName = '/timesheet-details';
          }
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
            default:
              page = ErrorPage(
                errorMessage: 'Page not found: ${settings.name}. Please try again.',
                onRetry: () {
                  NavigationService.navigatorKey.currentState?.pop();
                },
              );
          }
          debugPrint('Generating route: $routeName');
          return MaterialPageRoute(
            builder: (context) => page,
            settings: RouteSettings(name: routeName),
          );
        },
      ),
    );
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