import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../screens/Auth/login_screen.dart';
import '../../widgets/commen/spacer.dart';

// Simple, modern sidebar navigation for TraceFlow mobile app, matching CreateVisitScreen and EditVisitScreen.
class AppSidebar extends StatelessWidget {
  const AppSidebar({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 600),
      transitionBuilder: (child, animation) => SlideTransition(
        position: Tween<Offset>(begin: const Offset(-1, 0), end: Offset.zero).animate(
          CurvedAnimation(parent: animation, curve: Curves.easeInOut),
        ),
        child: child,
      ),
      child: Drawer(
        key: const ValueKey('sidebar'),
        width: 300,
        backgroundColor: theme.colorScheme.background,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.horizontal(right: Radius.circular(12)),
        ),
        elevation: 0,
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
                child: Text(
                  'TraceFlow',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    fontSize: 30,
                    color: theme.colorScheme.primary,
                    fontFamily: 'Inter',
                  ),
                ),
              ),
              const Divider(
                height: 1,
                thickness: 1,
                color: Colors.grey,
                indent: 12,
                endIndent: 12,
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    _buildNavItem(
                      context,
                      icon: Icons.home_outlined,
                      label: 'Dashboard',
                      route: '/supervisor-dashboard',
                    ),
                    const CustomSpacer(height: 8),
                    _buildNavItem(
                      context,
                      icon: Icons.person_outline,
                      label: 'Profile',
                      route: '/profile',
                    ),
                    const CustomSpacer(height: 8),
                    _buildNavItem(
                      context,
                      icon: Icons.schedule,
                      label: 'Timesheet',
                      route: '/timesheet-details',
                    ),
                    const CustomSpacer(height: 8),
                    _buildNavItem(
                      context,
                      icon: Icons.receipt_long_rounded,
                      label: 'Receipt Books',
                      route: '/receipt-books',
                    ),
                    const CustomSpacer(height: 8),
                    _buildNavItem(
                      context,
                      icon: Icons.map_outlined,
                      label: 'Map',
                      route: '/map',
                    ),
                  ],
                ),
              ),
              const Divider(
                height: 1,
                thickness: 1,
                color: Colors.grey,
                indent: 12,
                endIndent: 12,
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.start,
                  children: [

                    _buildIconButton(
                      context,
                      icon: Icons.logout,
                      tooltip: 'Logout',
                      color: Colors.redAccent,
                      onTap: () {
                        Provider.of<AuthProvider>(context, listen: false).logout();
                        Navigator.pushAndRemoveUntil(
                          context,
                          MaterialPageRoute(builder: (_) => const LoginScreen()),
                              (route) => false,
                        );
                      },
                    ),
                    const CustomSpacer(width: 12),
                    Consumer<ThemeProvider>(
                      builder: (context, themeProvider, _) => _buildIconButton(
                        context,
                        icon: _getThemeIcon(themeProvider.themeMode),
                        tooltip: 'Toggle Theme',
                        onTap: () {
                          final nextMode = _getNextThemeMode(themeProvider.themeMode);
                          themeProvider.setTheme(nextMode);
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(
      BuildContext context, {
        required IconData icon,
        required String label,
        String? route,
        VoidCallback? onTap,
        Color? color,
      }) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap ??
          (route != null
              ? () => Navigator.pushReplacementNamed(context, route)
              : null),
      borderRadius: BorderRadius.circular(8),
      splashColor: theme.colorScheme.primary.withOpacity(0.2),
      highlightColor: theme.colorScheme.primary.withOpacity(0.1),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          border: Border.all(
            color: theme.colorScheme.primary.withOpacity(0.7),
            width: 1.5,
          ),
          borderRadius: BorderRadius.circular(8),
          color: theme.colorScheme.background,
        ),
        child: Row(
          children: [
            Icon(
              icon,
              color: color ?? theme.colorScheme.primary,
              size: 18,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: color ?? theme.colorScheme.onSurface,
                  fontWeight: FontWeight.w600,
                  fontFamily: 'Inter',
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIconButton(
      BuildContext context, {
        required IconData icon,
        required String tooltip,
        VoidCallback? onTap,
        Color? color,
      }) {
    final theme = Theme.of(context);
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        splashColor: (color ?? theme.colorScheme.primary).withOpacity(0.2),
        highlightColor: (color ?? theme.colorScheme.primary).withOpacity(0.1),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Icon(
            icon,
            color: color ?? theme.colorScheme.primary,
            size: 18,
          ),
        ),
      ),
    );
  }

  IconData _getThemeIcon(ThemeMode mode) {
    switch (mode) {
      case ThemeMode.system:
        return Icons.hdr_auto;
      case ThemeMode.light:
        return Icons.light_mode_rounded;
      case ThemeMode.dark:
        return Icons.brightness_2;
    }
  }

  ThemeMode _getNextThemeMode(ThemeMode current) {
    switch (current) {
      case ThemeMode.system:
        return ThemeMode.light;
      case ThemeMode.light:
        return ThemeMode.dark;
      case ThemeMode.dark:
        return ThemeMode.system;
    }
  }
}