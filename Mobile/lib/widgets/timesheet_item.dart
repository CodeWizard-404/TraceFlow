import 'package:flutter/material.dart';
import '../models/timesheet.dart';

class TimesheetItem extends StatelessWidget {
  final Timesheet timesheet;

  const TimesheetItem(this.timesheet, {super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, '/timesheet-details', arguments: timesheet),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Week ${timesheet.weekNumber}, ${timesheet.year}',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF4CB1C7)),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Status: ${timesheet.status ?? 'Unknown'}',
                      style: TextStyle(fontSize: 14, color: Colors.grey[700]),
                    ),
                  ],
                ),
              ),
              Chip(
                label: Text(
                  timesheet.status?.toUpperCase() ?? 'UNKNOWN',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: _getStatusColor(timesheet.status)),
                ),
                backgroundColor: _getStatusColor(timesheet.status)?.withOpacity(0.2),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color? _getStatusColor(String? status) {
    switch (status?.toLowerCase()) {
      case 'completed':
        return Colors.green;
      case 'pending':
        return Colors.orange;
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }
}