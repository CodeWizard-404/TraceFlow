import 'package:flutter/material.dart';
import '../widgets/day_view.dart';
import '../widgets/week_view.dart';
import 'create_visit.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  _HomeScreenState createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  DateTime _currentDate = DateTime.now();
  late PageController _pageController;
  bool _isWeekView = true;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _getOffset(_currentDate));
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
    setState(() {
      _isWeekView = !_isWeekView;
      _currentDate = _isWeekView ? _getStartOfWeek(DateTime.now()) : DateTime.now();
      _pageController.jumpToPage(_getOffset(_currentDate));
    });
  }

  void _goToTodayOrThisWeek() {
    setState(() {
      _currentDate = _isWeekView ? _getStartOfWeek(DateTime.now()) : DateTime.now();
      _pageController.jumpToPage(_getOffset(_currentDate));
    });
  }

  DateTime _getStartOfWeek(DateTime date) {
    return date.subtract(Duration(days: date.weekday - 1));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: PreferredSize(
        preferredSize: Size.fromHeight(80),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF4CB1C7), Color(0xFF64C9D1)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
          ),
          child: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            title: Text(
              "Visit Mangements",
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            centerTitle: true,
            actions: [

              IconButton(
                icon: Icon(_isWeekView ? Icons.view_week : Icons.view_day, color: Colors.white, size: 28),
                onPressed: _toggleView,
              ),
              IconButton(
                icon: Icon(Icons.today, color: Colors.white, size: 28),
                onPressed: _goToTodayOrThisWeek,
              ),
            ],
          ),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 16.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: Icon(Icons.arrow_back_ios, color: Color(0xFF4CB1C7), size: 24),
                  onPressed: () {
                    _pageController.previousPage(duration: Duration(milliseconds: 300), curve: Curves.easeInOut);
                  },
                ),
                Text(
                  _isWeekView
                      ? 'Week ${_getWeekNumber(_currentDate)}, ${_currentDate.year}'
                      : 'Day ${_currentDate.day}, ${_currentDate.month}/${_currentDate.year}',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Color(0xFF4CB1C7)),
                ),
                IconButton(
                  icon: Icon(Icons.arrow_forward_ios, color: Color(0xFF4CB1C7), size: 24),
                  onPressed: () {
                    _pageController.nextPage(duration: Duration(milliseconds: 300), curve: Curves.easeInOut);
                  },
                ),
              ],
            ),
          ),
          Expanded(
            child: PageView.builder(
              controller: _pageController,
              onPageChanged: (index) => _navigateToDate(index),
              itemBuilder: (context, index) {
                final date = DateTime(_currentDate.year, 1, 1).add(Duration(days: _isWeekView ? index * 7 : index));
                return _isWeekView ? WeekView(date) : DayView(date);
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
        backgroundColor: Color(0xFF4CB1C7),
        child: Icon(Icons.add, color: Colors.white, size: 32),
      ),
    );
  }

  int _getWeekNumber(DateTime date) {
    final startOfYear = DateTime(date.year, 1, 1);
    return (date.difference(startOfYear).inDays / 7).ceil();
  }
}