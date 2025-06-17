import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/timesheet_provider.dart';
import '../../widgets/Timesheet/day_view.dart';
import '../../widgets/Timesheet/navigation_bar.dart';
import '../../widgets/Timesheet/week_view_list.dart';
import '../../widgets/Timesheet/week_view_calendar.dart';
import '../../widgets/Timesheet/month_view.dart';
import '../../widgets/Timesheet/year_view.dart';
import '../../widgets/appbar/app_bar.dart';
import '../../widgets/appbar/sidebar.dart';
import '../../widgets/commen/ViewSelector.dart';
import '../../widgets/commen/empty_state.dart';
import '../../widgets/commen/floating_action_button.dart';
import '../../widgets/commen/progress_indicator.dart';
import '../Error.dart';
import '../Visit/create_visit.dart';

class TimesheetDetailsScreen extends StatefulWidget {
  const TimesheetDetailsScreen({super.key});

  @override
  TimesheetDetailsScreenState createState() => TimesheetDetailsScreenState();
}

class TimesheetDetailsScreenState extends State<TimesheetDetailsScreen>
    with SingleTickerProviderStateMixin {
  DateTime _currentDate = DateTime.now();
  late PageController _pageController;
  late AnimationController _animationController;
  String _currentView = 'week1';
  final GlobalKey<ScaffoldMessengerState> _scaffoldMessengerKey =
  GlobalKey<ScaffoldMessengerState>();

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _getOffset(_currentDate));
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) => _fetchTimesheets());
  }

  @override
  void dispose() {
    _pageController.dispose();
    _animationController.dispose();
    super.dispose();
  }

  int _getOffset(DateTime date) {
    final now = DateTime.now();
    switch (_currentView) {
      case 'day':
        return date.difference(DateTime(now.year - 100, 1, 1)).inDays;
      case 'week1':
      case 'week2':
        final firstMonday = _getFirstMondayOfYear(now.year - 100);
        return (date.difference(firstMonday).inDays / 7).floor();
      case 'month':
        final baseDate = DateTime(now.year - 100, 1, 1);
        final totalMonths =
            (date.year - baseDate.year) * 12 + date.month - baseDate.month;
        return totalMonths;
      case 'year':
        return date.year - now.year;
      default:
        return 0;
    }
  }

  DateTime _getFirstMondayOfYear(int year) {
    final firstDay = DateTime(year, 1, 1);
    final daysOffset = (firstDay.weekday - 1) % 7;
    return firstDay.subtract(Duration(days: daysOffset));
  }

  void _navigateToDate(int index) {
    setState(() {
      final now = DateTime.now();
      switch (_currentView) {
        case 'day':
          _currentDate = DateTime(now.year - 100, 1, 1).add(Duration(days: index));
          break;
        case 'week1':
        case 'week2':
          final firstMonday = _getFirstMondayOfYear(now.year - 100);
          _currentDate = firstMonday.add(Duration(days: index * 7));
          break;
        case 'month':
          final baseDate = DateTime(now.year - 100, 1, 1);
          final totalMonths = index;
          final newYear = baseDate.year + (totalMonths ~/ 12);
          final newMonth = (baseDate.month + (totalMonths % 12) - 1) % 12 + 1;
          _currentDate = DateTime(newYear, newMonth, 1);
          break;
        case 'year':
          _currentDate = DateTime(now.year + index, 1, 1);
          break;
      }
    });
    _animationController.forward(from: 0);
  }

  void _setView(String view, {DateTime? specificDate}) {
    setState(() {
      _currentView = view;
      if (specificDate != null) _currentDate = specificDate;
      // Only jump to page if PageView is available
      if (_pageController.hasClients) {
        _pageController.jumpToPage(_getOffset(_currentDate));
      }
    });
  }

  void _jumpToNow() {
    setState(() {
      _currentDate = DateTime.now();
      if (_pageController.hasClients) {
        _pageController.animateToPage(
          _getOffset(_currentDate),
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut,
        );
      }
    });
  }

  Future<void> _fetchTimesheets() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);
    if (authProvider.user?.userID != null) {
      try {
        await timesheetProvider.fetchTimesheetsBySupervisor(authProvider.user!.userID!);
      } catch (error) {
        _scaffoldMessengerKey.currentState?.showSnackBar(
          SnackBar(content: Text('Failed to load timesheets: $error')),
        );
      }
    } else {
      _scaffoldMessengerKey.currentState?.showSnackBar(
        const SnackBar(content: Text('User not authenticated')),
      );
    }
  }

  Widget _buildView(DateTime date, bool hasTimesheets) {
    if (!hasTimesheets) {
      return const EmptyState(text: 'No timesheets available');
    }
    switch (_currentView) {
      case 'day':
        return DayView(date);
      case 'week1':
        return WeekViewList(
          date,
          onDayTap: (day) => _setView('day', specificDate: day),
          scaffoldMessengerKey: _scaffoldMessengerKey,
        );
      case 'week2':
        return WeekViewCalendar(
          date,
          onDayTap: (day) => _setView('day', specificDate: day),
          scaffoldMessengerKey: _scaffoldMessengerKey,
        );
      case 'month':
        return MonthView(
          date: date,
          onDayTap: (day) => _setView('day', specificDate: day),
        );
      case 'year':
        return YearView(
          date: date,
          onMonthTap: (month) => _setView('month', specificDate: month),
        );
      default:
        return const EmptyState(text: 'Invalid view');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final appBarHeight = 60.0;
    final navBarHeight = 40.0;
    final totalHeaderHeight = appBarHeight + navBarHeight + MediaQuery.of(context).padding.top;

    return Scaffold(
      key: _scaffoldMessengerKey,
      drawer: const AppSidebar(),
      body: RefreshIndicator(
        onRefresh: _fetchTimesheets,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: CustomAppBar(
                title: 'Timesheets',
                showBackButton: false,
                viewSelector: CustomViewSelector(
                  value: _currentView,
                  onChanged: (value) => _setView(value),
                ),
                onJumpToNow: _jumpToNow,
              ),
            ),
            SliverToBoxAdapter(
              child: TimesheetNavigationBar(
                currentView: _currentView,
                currentDate: _currentDate,
                onPrevious: () {
                  if (_pageController.hasClients) {
                    _pageController.previousPage(
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeInOut,
                    );
                  }
                },
                onNext: () {
                  if (_pageController.hasClients) {
                    _pageController.nextPage(
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeInOut,
                    );
                  }
                },
              ),
            ),
            SliverToBoxAdapter(
              child: Consumer<TimesheetProvider>(
                builder: (context, provider, child) {
                  if (provider.isLoading) {
                    return const Center(child: CustomProgressIndicator());
                  }
                  return Container(
                    height: MediaQuery.of(context).size.height - totalHeaderHeight,
                    padding: const EdgeInsets.all(8.0),
                    child: PageView.builder(
                      controller: _pageController,
                      physics: const AlwaysScrollableScrollPhysics(),
                      onPageChanged: _navigateToDate,
                      itemBuilder: (context, index) {
                        final date = _getDateForIndex(index);
                        return SingleChildScrollView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          child: _buildSectionCard(
                            context,
                            title: _getViewTitle(),
                            children: [_buildView(date, provider.timesheets.isNotEmpty)],
                          ),
                        );
                      },
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: CustomFloatingActionButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => CreateVisitScreen(
                weekNumber: _getWeekNumber(_currentDate),
                year: _currentDate.year,
              ),
            ),
          ).then((_) => _fetchTimesheets());
        },
        icon: Icons.add,
      ),
    );
  }

  String _getViewTitle() {
    switch (_currentView) {
      case 'day':
        return 'Day View';
      case 'week1':
      case 'week2':
        return 'Week View';
      case 'month':
        return 'Month View';
      case 'year':
        return 'Year View';
      default:
        return 'Timesheet';
    }
  }

  Widget _buildSectionCard(BuildContext context, {required String title, required List<Widget> children}) {
    final theme = Theme.of(context);
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: theme.colorScheme.primary.withOpacity(0.7),
          width: 1.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Text(
              title,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: theme.colorScheme.primary,
              ),
            ),
          ),
          const Divider(height: 1, thickness: 1, color: Colors.grey),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(children: children),
          ),
        ],
      ),
    );
  }

  DateTime _getDateForIndex(int index) {
    final now = DateTime.now();
    switch (_currentView) {
      case 'day':
        return DateTime(now.year - 100, 1, 1).add(Duration(days: index));
      case 'week1':
      case 'week2':
        final firstMonday = _getFirstMondayOfYear(now.year - 100);
        return firstMonday.add(Duration(days: index * 7));
      case 'month':
        final baseDate = DateTime(now.year - 100, 1, 1);
        final totalMonths = index;
        final newYear = baseDate.year + (totalMonths ~/ 12);
        final newMonth = (baseDate.month + (totalMonths % 12) - 1) % 12 + 1;
        return DateTime(newYear, newMonth, 1);
      case 'year':
        return DateTime(now.year + index, 1, 1);
      default:
        return now;
    }
  }

  int _getWeekNumber(DateTime date) {
    final firstDayOfYear = DateTime(date.year, 1, 1);
    final daysOffset = firstDayOfYear.weekday - 1;
    final firstMonday = firstDayOfYear.subtract(Duration(days: daysOffset));
    return (date.difference(firstMonday).inDays / 7).ceil();
  }
}