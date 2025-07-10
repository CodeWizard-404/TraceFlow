import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:TraceFlow/providers/auth_provider.dart';

class BottomNavBar extends StatelessWidget {
  final int currentIndex;
  final Function(int)? onTap;

  const BottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final authProvider = Provider.of<AuthProvider>(context);

    return SafeArea(
      bottom: true,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: const BoxDecoration(
          color: Colors.transparent, // Transparent container background
        ),
        child: Container(
          // Inner container for the opaque box with border
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
          decoration: BoxDecoration(
            color: theme.colorScheme.surface, // Opaque surface color
            border: Border.all(
              color: theme.colorScheme.primary.withOpacity(0.2),
              width: 1,
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: theme.colorScheme.primary.withOpacity(0.1),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _buildNavItem(
                context,
                index: 0,
                icon: Icons.schedule,
                label: 'Timesheet',
                route: '/timesheet-details',
                isSelected: currentIndex == 0,
                authProvider: authProvider,
              ),
              _buildNavItem(
                context,
                index: 1,
                icon: Icons.receipt_long_rounded,
                label: 'Receipts',
                route: '/receipt-books',
                isSelected: currentIndex == 1,
                authProvider: authProvider,
              ),
              _buildNavItem(
                context,
                index: 2,
                icon: Icons.person,
                label: 'Profile',
                route: '/profile',
                isSelected: currentIndex == 2,
                authProvider: authProvider,
              ),
              _buildNavItem(
                context,
                index: 3,
                icon: Icons.dashboard,
                label: 'Dashboard',
                route: '/supervisor-dashboard',
                isSelected: currentIndex == 3,
                isDashboard: true,
                authProvider: authProvider,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(
      BuildContext context, {
        required int index,
        required IconData icon,
        required String label,
        required String route,
        required bool isSelected,
        bool isDashboard = false,
        required AuthProvider authProvider,
      }) {
    final theme = Theme.of(context);
    final isProtectedRoute = ![
      '/login',
      '/verify-2fa',
      '/forgot-password',
      '/reset-password'
    ].contains(ModalRoute.of(context)?.settings.name);

    return GestureDetector(
      onTap: authProvider.user == null && isProtectedRoute
          ? null
          : () => onTap?.call(index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected
              ? theme.colorScheme.primary.withOpacity(0.1)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Transform.translate(
          offset: isSelected ? const Offset(0, -8) : Offset.zero,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                alignment: Alignment.center,
                children: [
                  if (isSelected)
                    AnimatedScale(
                      scale: isDashboard ? 1.2 : 1.1,
                      duration: const Duration(milliseconds: 250),
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: theme.colorScheme.primary.withOpacity(0.15),
                        ),
                      ),
                    )
                  else
                    Container(
                      width: 24, // Slightly smaller for unselected
                      height: 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: theme.colorScheme.onSurface.withOpacity(0.05), // Subtle background
                      ),
                    ),
                  Icon(
                    icon,
                    size: isSelected ? 24 : 22, // Slightly larger for unselected
                    color: isSelected
                        ? theme.colorScheme.primary
                        : theme.colorScheme.onSurface.withOpacity(0.8), // Increased opacity
                  ),
                ],
              ),
              if (isSelected) ...[
                const SizedBox(height: 4),
                Text(
                  label,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontWeight: FontWeight.w600,
                    fontSize: 10,
                    color: theme.colorScheme.primary,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}