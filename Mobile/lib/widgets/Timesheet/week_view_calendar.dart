import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../models/visit.dart';
import '../../providers/timesheet_provider.dart';
import '../../screens/Visit/visit_details.dart';
import '../commen/empty_state.dart';

class WeekViewCalendar extends StatelessWidget {
  final DateTime date;
  final Function(DateTime)? onDayTap;

  const WeekViewCalendar(this.date, {this.onDayTap, super.key});

  List<DateTime> _getWeekDays(DateTime date) {
    final startOfWeek = date.subtract(Duration(days: date.weekday - 1));
    return List.generate(7, (index) => startOfWeek.add(Duration(days: index))); // Changed from 5 to 7
  }

  DateTime? _parseVisitStartTime(DateTime visitDate, String time) {
    try {
      final timeFormat = DateFormat('HH:mm');
      final timeOfDay = timeFormat.parse(time);
      return DateTime(
        visitDate.year,
        visitDate.month,
        visitDate.day,
        timeOfDay.hour,
        timeOfDay.minute,
      );
    } catch (e) {
      return DateTime(visitDate.year, visitDate.month, visitDate.day, 8, 0);
    }
  }

  Color _getStatusColor(BuildContext context, String? status) {
    switch (status?.toLowerCase()) {
      case 'visited':
        return Theme.of(context).colorScheme.primary;
      case 'pending':
        return const Color(0xFFF4B400);
      case 'rejected':
        return const Color(0xFFD93025);
      case 'validated':
        return const Color(0xFF2EA44F);
      default:
        return Theme.of(context).colorScheme.onSurface.withOpacity(0.6);
    }
  }

  List<List<Visit>> _groupOverlappingVisits(List<Visit> visits, List<DateTime> weekDays) {
    final groupedVisits = List.generate(weekDays.length, (_) => <Visit>[]);
    for (var visit in visits) {
      final visitDate = visit.date;
      final dayIndex = weekDays.indexWhere((d) =>
      d.day == visitDate.day && d.month == visitDate.month && d.year == visitDate.year);
      if (dayIndex != -1) groupedVisits[dayIndex].add(visit);
    }

    for (var dayVisits in groupedVisits) {
      dayVisits.sort((a, b) => _parseVisitStartTime(a.date, a.time)!
          .compareTo(_parseVisitStartTime(b.date, b.time)!));
    }
    return groupedVisits;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final weekDays = _getWeekDays(date);
    const int startHour = 8;
    const int endHour = 18;
    const double hourHeight = 70.0;
    const double timeColumnWidth = 50.0;
    const double sidePadding = 1.0;
    final availableWidth = MediaQuery.of(context).size.width - timeColumnWidth - (sidePadding * 2);
    final columnWidth = availableWidth / 7.25; // Changed from 5.25 to 7.25

    return Consumer<TimesheetProvider>(
      builder: (context, provider, child) {
        if (provider.timesheets.isEmpty) return const EmptyState(text: 'No timesheets available');

        final visits = provider.timesheets
            .expand((t) => t.visits ?? [])
            .where((visit) {
          final visitDate = visit.date;
          final startTime = _parseVisitStartTime(visitDate, visit.time);
          return startTime != null &&
              startTime.hour >= startHour &&
              startTime.hour < endHour;
        })
            .toList()
            .cast<Visit>();

        final groupedVisits = _groupOverlappingVisits(visits, weekDays);

        return Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(vertical: 4),
              decoration: BoxDecoration(
                color: theme.cardColor,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  SizedBox(
                    width: timeColumnWidth,
                    child: Text(
                      'Time',
                      style: theme.textTheme.labelSmall?.copyWith(fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  ...weekDays.map((day) => Expanded(
                    child: Text(
                      DateFormat('EEE d').format(day),
                      style: theme.textTheme.labelSmall?.copyWith(fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                  )),
                ],
              ),
            ),
            SizedBox(
              height: (endHour - startHour) * hourHeight,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(
                    width: timeColumnWidth,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: List.generate(endHour - startHour, (index) {
                        final hour = startHour + index;
                        return SizedBox(
                          height: hourHeight,
                          child: Center(
                            child: Text(
                              '${hour.toString().padLeft(2, '0')}:00',
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: theme.colorScheme.onSurface.withOpacity(0.6),
                              ),
                            ),
                          ),
                        );
                      }),
                    ),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: sidePadding),
                      child: Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: theme.dividerColor.withOpacity(0.2)),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Stack(
                          children: [
                            Row(
                              children: weekDays.map((day) {
                                return Expanded(
                                  child: Container(
                                    decoration: BoxDecoration(
                                      border: Border(
                                        right: BorderSide(color: theme.dividerColor.withOpacity(0.2)),
                                      ),
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                            ...weekDays.asMap().entries.expand((entry) {
                              final dayIndex = entry.key;
                              final dayVisits = groupedVisits[dayIndex];
                              final overlaps = <List<Visit>>[];
                              var currentOverlap = <Visit>[];

                              for (var i = 0; i < dayVisits.length; i++) {
                                final currentVisit = dayVisits[i];
                                final currentStart = _parseVisitStartTime(currentVisit.date, currentVisit.time)!;
                                if (currentOverlap.isEmpty) {
                                  currentOverlap.add(currentVisit);
                                } else {
                                  final lastVisit = currentOverlap.last;
                                  final lastStart = _parseVisitStartTime(lastVisit.date, lastVisit.time)!;
                                  if (currentStart.difference(lastStart).inMinutes.abs() < 30) {
                                    currentOverlap.add(currentVisit);
                                  } else {
                                    overlaps.add(currentOverlap);
                                    currentOverlap = [currentVisit];
                                  }
                                }
                                if (i == dayVisits.length - 1) overlaps.add(currentOverlap);
                              }

                              return overlaps.expand((overlapGroup) {
                                return overlapGroup.asMap().entries.map((entry) {
                                  final visit = entry.value;
                                  final overlapIndex = entry.key;
                                  final overlapCount = overlapGroup.length;
                                  final startTime = _parseVisitStartTime(visit.date, visit.time)!;
                                  final startMinutes = (startTime.hour - startHour) * 60 + startTime.minute;
                                  final top = startMinutes * (hourHeight / 60);
                                  final visitWidth = columnWidth / overlapCount;

                                  final leftPosition = dayIndex * columnWidth + overlapIndex * visitWidth;

                                  return Positioned(
                                    top: top,
                                    left: leftPosition,
                                    width: visitWidth,
                                    height: hourHeight,
                                    child: GestureDetector(
                                      onTap: () {
                                        Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (_) => VisitDetailsScreen(visit: visit),
                                          ),
                                        );
                                      },
                                      child: Container(
                                        margin: const EdgeInsets.all(5),
                                        decoration: BoxDecoration(
                                          color: Colors.grey.withOpacity(0.2),
                                          border: Border.all(
                                            color: _getStatusColor(context, visit.status),
                                            width: 1,
                                          ),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Center(
                                          child: Column(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Text(
                                                visit.time.split(':').take(2).join(':'),
                                                style: theme.textTheme.labelSmall?.copyWith(
                                                  color: theme.colorScheme.onSurface,
                                                  fontSize: 10,
                                                ),
                                                textAlign: TextAlign.center,
                                              ),
                                              Text(
                                                visit.location ?? 'Visit',
                                                style: theme.textTheme.labelSmall?.copyWith(
                                                  color: theme.colorScheme.onSurface.withOpacity(0.8),
                                                  fontSize: 9,
                                                ),
                                                textAlign: TextAlign.center,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                });
                              });
                            }),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}