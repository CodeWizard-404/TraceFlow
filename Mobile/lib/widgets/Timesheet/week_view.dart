import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'day_view.dart';

class WeekView extends StatelessWidget {
  final DateTime weekStartDate;

  const WeekView(this.weekStartDate, {super.key});

  List<DateTime> getWeekDays(DateTime startDate) {
    DateTime monday = startDate.subtract(Duration(days: startDate.weekday - 1));
    return List.generate(5, (index) => monday.add(Duration(days: index)));
  }

  @override
  Widget build(BuildContext context) {
    final weekDays = getWeekDays(weekStartDate);

    return ListView.builder(
      itemCount: weekDays.length,
      itemBuilder: (context, index) {
        final day = weekDays[index];
        return Card(
          key: ValueKey(day), // Unique key based on the day
          margin: EdgeInsets.symmetric(vertical: 8, horizontal: 16),
          elevation: 3,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: InkWell(
            onTap: () {
              // Navigate to Day View or Details
            },
            borderRadius: BorderRadius.circular(12),
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Colors.white, Color(0xFFFFFFFF)],
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      DateFormat('EEEE').format(day),
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4CB1C7)),
                    ),
                    SizedBox(height: 8),
                    Text(
                      DateFormat('MMMM d').format(day),
                      style: TextStyle(fontSize: 14, color: Colors.grey[700]),
                    ),
                    SizedBox(height: 12),
                    Divider(color: Colors.grey[300]),
                    SizedBox(height: 12),
                    DayView(day),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}