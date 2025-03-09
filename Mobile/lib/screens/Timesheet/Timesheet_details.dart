import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/timesheet_provider.dart';
import '../../widgets/Timesheet/day_view.dart';
import '../../widgets/Timesheet/week_view.dart';
import '../../widgets/Glass_Effect/GlassContainer.dart';
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
      duration: Duration(milliseconds: 600),
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
    final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);
    timesheetProvider.fetchTimesheets().catchError((error) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to load timesheets: $error'),
          backgroundColor: Colors.red.withOpacity(0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    });
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
        duration: Duration(milliseconds: 600),
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
        duration: Duration(milliseconds: 600),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  DateTime _getStartOfWeek(DateTime date) {
    return date.subtract(Duration(days: date.weekday - 1));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 140, // Increased to accommodate vertical layout
            floating: true,
            pinned: false,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF4CB1C7), Color(0xFF64C9D1)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.2),
                      blurRadius: 20,
                      offset: Offset(0, 4),
                    ),
                  ],
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(30),
                    bottomRight: Radius.circular(30),
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              "Visit Management",
                              style: TextStyle(
                                fontSize: 28, // Original size restored
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                                shadows: [Shadow(color: Colors.black26, blurRadius: 4, offset: Offset(0, 2))],
                              ),
                            ),
                            SizedBox(width: 8), // To maintain some spacing
                          ],
                        ),
                        SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            _buildAnimatedIconButton(
                              icon: Icons.refresh,
                              onPressed: _fetchTimesheets,
                            ),
                            SizedBox(width: 8),
                            _buildAnimatedIconButton(
                              icon: _isWeekView ? Icons.view_week : Icons.view_day,
                              onPressed: _toggleView,
                            ),
                            SizedBox(width: 8),
                            _buildAnimatedIconButton(
                              icon: Icons.today,
                              onPressed: _goToTodayOrThisWeek,
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
              padding: EdgeInsets.all(16),
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
                          duration: Duration(milliseconds: 600),
                          curve: Curves.easeInOutCubic,
                        );
                      }),
                      AnimatedSwitcher(
                        duration: Duration(milliseconds: 400),
                        transitionBuilder: (child, animation) => FadeTransition(
                          opacity: animation,
                          child: ScaleTransition(scale: animation, child: child),
                        ),
                        child: Text(
                          _isWeekView
                              ? 'Week ${_getWeekNumber(_currentDate)}'
                              : ' ${_currentDate.day} ${DateFormat('MMMM').format(_currentDate)}',
                          key: ValueKey(_isWeekView),
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF4CB1C7),
                          ),
                        ),
                      ),
                      _buildNavigationButton(Icons.arrow_forward_ios, () {
                        _pageController.nextPage(
                          duration: Duration(milliseconds: 600),
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
                return Padding(  // Add this Padding widget
                  padding: EdgeInsets.symmetric(horizontal: 16), // Adjust padding value as needed
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
              colors: [Color(0xFF4CB1C7), Color(0xFF64C9D1)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: Color(0xFF4CB1C7).withOpacity(0.4),
                blurRadius: 12,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: Icon(Icons.add, color: Colors.white, size: 32),
        ),
      ),
    );
  }

  Widget _buildAnimatedIconButton({required IconData icon, required VoidCallback onPressed}) {
    return GestureDetector(
      onTap: onPressed,
      child: AnimatedContainer(
        duration: Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        padding: EdgeInsets.all(12),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white.withOpacity(0.2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Icon(icon, color: Colors.white, size: 24),
      ),
    );
  }

  Widget _buildNavigationButton(IconData icon, VoidCallback onPressed) {
    return GestureDetector(
      onTap: onPressed,
      child: AnimatedContainer(
        duration: Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        padding: EdgeInsets.all(12),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(
            colors: [Color(0xFF4CB1C7).withOpacity(0.2), Color(0xFF64C9D1).withOpacity(0.2)],
          ),
          boxShadow: [
            BoxShadow(
              color: Color(0xFF4CB1C7).withOpacity(0.2),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
    );
  }

  int _getWeekNumber(DateTime date) {
    final startOfYear = DateTime(date.year, 1, 1);
    return (date.difference(startOfYear).inDays / 7).ceil();
  }
}