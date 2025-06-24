import 'package:flutter/material.dart';
import 'package:TraceFlow/main.dart';

class CustomAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final bool showBackButton;
  final Widget? viewSelector;
  final VoidCallback? onJumpToNow;

  const CustomAppBar({
    required this.title,
    this.showBackButton = true,
    this.viewSelector,
    this.onJumpToNow,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: Container(
        height: 60,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: theme.scaffoldBackgroundColor,
          border: Border(
            bottom: BorderSide(
              color: theme.dividerColor.withOpacity(0.3),
              width: 1,
            ),
          ),
        ),
        child: Row(
          children: [
            if (showBackButton)
              IconButton(
                icon: const Icon(Icons.chevron_left_rounded, size: 28),
                color: theme.colorScheme.primary,
                onPressed: () {
                  // Check if there's a previous page to pop back to
                  if (Navigator.of(context).canPop()) {
                    Navigator.pop(context); // Pop to previous page
                  } else {
                    // No previous page, redirect to home page
                    NavigationService.navigatorKey.currentState?.pushNamedAndRemoveUntil(
                      '/timesheet-details', // Default home route
                          (route) => false, // Remove all previous routes
                    );
                  }
                },
                splashRadius: 20,
              ),
            Expanded(
              child: Text(
                title,
                style: theme.appBarTheme.titleTextStyle?.copyWith(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (viewSelector != null)
              Padding(
                padding: const EdgeInsets.only(left: 12),
                child: viewSelector!,
              ),
            if (onJumpToNow != null)
              IconButton(
                icon: const Icon(Icons.gps_fixed_outlined, size: 28),
                color: theme.colorScheme.primary,
                onPressed: onJumpToNow,
                splashRadius: 20,
                tooltip: 'Go to Today',
              ),
            IconButton(
              icon: const Icon(Icons.menu_rounded, size: 28),
              color: theme.colorScheme.primary,
              onPressed: () => Scaffold.of(context).openDrawer(),
              splashRadius: 20,
            ),
          ],
        ),
      ),
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(60);
}