import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../Glass_Effect/GlassChip.dart';
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
      padding: EdgeInsets.symmetric(vertical: 8),
      itemCount: weekDays.length,
      itemBuilder: (context, index) {
        final day = weekDays[index];
        return Padding(
          padding: EdgeInsets.symmetric(vertical: 8, horizontal: 16),
          child: AnimatedContainer(
            duration: Duration(milliseconds: 300),
            curve: Curves.easeInOut,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Theme.of(context).colorScheme.surface.withOpacity(0.9),
                  Theme.of(context).colorScheme.surface.withOpacity(0.7),
                ],
              ),
              boxShadow: [
                BoxShadow(
                  color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
                  blurRadius: 12,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        DateFormat('EEEE').format(day),
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      GlassChip(
                        label: DateFormat('MMM d').format(day),
                      ),
                    ],
                  ),
                  SizedBox(height: 16),
                  DayView(day),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}