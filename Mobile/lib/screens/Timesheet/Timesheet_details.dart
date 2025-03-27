// lib/screens/Timesheet/Timesheet_details.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/timesheet_provider.dart';
import '../../providers/theme_provider.dart';
import '../../widgets/Timesheet/day_view.dart';
import '../../widgets/Timesheet/week_view.dart';
import '../../widgets/Glass_Effect/GlassContainer.dart';
import '../Error.dart';
import '../Visit/create_visit.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  HomeScreenState createState() => HomeScreenState();
}

class HomeScreenState extends State<HomeScreen> with SingleTickerProviderStateMixin {
  DateTime _currentDate = DateTime.now();
  late PageController _pageController;
  late AnimationController _animationController;
  bool _isWeekView = true;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _getOffset(_currentDate));
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fetchTimesheets();
  }

  @override
  void dispose() {
    _pageController.dispose();
    _animationController.dispose();
    super.dispose();
  }

  void _fetchTimesheets() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);
    if (authProvider.user?.userID != null && authProvider.token != null) {
      timesheetProvider
          .fetchTimesheetsBySupervisor(authProvider.user!.userID!, authProvider.token!)
          .catchError((error) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ErrorPage(
              errorMessage: 'Failed to load timesheets: $error',
              onRetry: _fetchTimesheets,
            ),
          ),
        );
      });
    }
  }

  int _getOffset(DateTime date) {
    if (_isWeekView) {
      DateTime monday = _getStartOfWeek(date);
      final startOfYear = DateTime(monday.year, 1, 1);
      return monday.difference(startOfYear).inDays ~/ 7;
    } else {
      final startOfYear = DateTime(date.year, 1, 1);
      return date.difference(startOfYear).inDays;
    }
  }

  void _navigateToDate(int offset) {
    setState(() {
      if (_isWeekView) {
        _currentDate = _getStartOfWeek(DateTime(_currentDate.year, 1, 1).add(Duration(days: offset * 7)));
      } else {
        _currentDate = DateTime(_currentDate.year, 1, 1).add(Duration(days: offset));
      }
    });
  }

  void _toggleView() {
    if (_animationController.isAnimating) return;
    _animationController.forward(from: 0);
    setState(() {
      _isWeekView = !_isWeekView;
      _currentDate = _isWeekView ? _getStartOfWeek(DateTime.now()) : DateTime.now();
      _pageController.animateToPage(
        _getOffset(_currentDate),
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  void _goToTodayOrThisWeek() {
    if (_animationController.isAnimating) return;
    _animationController.forward(from: 0);
    setState(() {
      _currentDate = _isWeekView ? _getStartOfWeek(DateTime.now()) : DateTime.now();
      _pageController.animateToPage(
        _getOffset(_currentDate),
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  DateTime _getStartOfWeek(DateTime date) {
    return date.subtract(Duration(days: date.weekday - 1));
  }

  void _showThemeNotification(String themeName) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Switched to $themeName theme'),
        backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.9),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 140,
            floating: true,
            pinned: false,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Theme.of(context).colorScheme.primary,
                      Theme.of(context).colorScheme.secondary,
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2),
                      blurRadius: 20,
                      offset: const Offset(0, 4),
                    ),
                  ],
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(30),
                    bottomRight: Radius.circular(30),
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              "TraceFlow",
                              style: Theme.of(context).appBarTheme.titleTextStyle,
                            ),
                            const SizedBox(width: 8),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            _buildAnimatedIconButton(
                              icon: Icons.refresh,
                              onPressed: _fetchTimesheets,
                            ),
                            const SizedBox(width: 8),
                            _buildAnimatedIconButton(
                              icon: _isWeekView ? Icons.view_week : Icons.view_day,
                              onPressed: _toggleView,
                            ),
                            const SizedBox(width: 8),
                            _buildAnimatedIconButton(
                              icon: Icons.today,
                              onPressed: _goToTodayOrThisWeek,
                            ),
                            const SizedBox(width: 8),
                            _buildAnimatedIconButton(
                              icon: themeProvider.themeMode == ThemeMode.system
                                  ? Icons.brightness_auto
                                  : themeProvider.isDarkMode
                                  ? Icons.light_mode
                                  : Icons.dark_mode,
                              onPressed: () {
                                if (themeProvider.themeMode == ThemeMode.system) {
                                  themeProvider.setTheme(ThemeMode.light);
                                  _showThemeNotification("Light");
                                } else if (themeProvider.themeMode == ThemeMode.light) {
                                  themeProvider.setTheme(ThemeMode.dark);
                                  _showThemeNotification("Dark");
                                } else {
                                  themeProvider.setTheme(ThemeMode.system);
                                  _showThemeNotification("System");
                                }
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: ScaleTransition(
                scale: Tween(begin: 0.95, end: 1.0).animate(
                  CurvedAnimation(parent: _animationController, curve: Curves.easeOutCubic),
                ),
                child: GlassContainer(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildNavigationButton(Icons.arrow_back_ios, () {
                        _pageController.previousPage(
                          duration: const Duration(milliseconds: 600),
                          curve: Curves.easeInOutCubic,
                        );
                      }),
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 400),
                        transitionBuilder: (child, animation) => FadeTransition(
                          opacity: animation,
                          child: ScaleTransition(scale: animation, child: child),
                        ),
                        child: Text(
                          _isWeekView
                              ? 'Week ${_getWeekNumber(_currentDate)}'
                              : '${_currentDate.day} ${DateFormat('MMMM').format(_currentDate)}',
                          key: ValueKey(_isWeekView),
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                      ),
                      _buildNavigationButton(Icons.arrow_forward_ios, () {
                        _pageController.nextPage(
                          duration: const Duration(milliseconds: 600),
                          curve: Curves.easeInOutCubic,
                        );
                      }),
                    ],
                  ),
                ),
              ),
            ),
          ),
          SliverFillRemaining(
            child: PageView.builder(
              controller: _pageController,
              onPageChanged: _navigateToDate,
              itemBuilder: (context, index) {
                final date = DateTime(_currentDate.year, 1, 1)
                    .add(Duration(days: _isWeekView ? index * 7 : index));
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 400),
                    transitionBuilder: (child, animation) => FadeTransition(
                      opacity: animation,
                      child: ScaleTransition(scale: animation, child: child),
                    ),
                    child: _isWeekView ? WeekView(date) : DayView(date),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => CreateVisitScreen(
                weekNumber: _getWeekNumber(_currentDate),
                year: _currentDate.year,
              ),
            ),
          );
        },
        backgroundColor: Colors.transparent,
        elevation: 0,
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Theme.of(context).colorScheme.primary,
                Theme.of(context).colorScheme.secondary,
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: Theme.of(context).colorScheme.primary.withOpacity(0.4),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Icon(Icons.add, color: Theme.of(context).appBarTheme.iconTheme!.color, size: 32),
        ),
      ),
    );
  }

  Widget _buildAnimatedIconButton({required IconData icon, required VoidCallback onPressed}) {
    return GestureDetector(
      onTap: onPressed,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Theme.of(context).colorScheme.onPrimary.withOpacity(0.2),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).colorScheme.onPrimary.withOpacity(0.1),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Icon(icon, color: Theme.of(context).appBarTheme.iconTheme!.color, size: 24),
      ),
    );
  }

  Widget _buildNavigationButton(IconData icon, VoidCallback onPressed) {
    return GestureDetector(
      onTap: onPressed,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(
            colors: [
              Theme.of(context).colorScheme.primary.withOpacity(0.2),
              Theme.of(context).colorScheme.secondary.withOpacity(0.2),
            ],
          ),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).colorScheme.primary.withOpacity(0.2),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Icon(icon, color: Theme.of(context).appBarTheme.iconTheme!.color, size: 20),
      ),
    );
  }

  int _getWeekNumber(DateTime date) {
    final startOfYear = DateTime(date.year, 1, 1);
    return (date.difference(startOfYear).inDays / 7).ceil();
  }
}