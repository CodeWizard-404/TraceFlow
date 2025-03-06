import 'package:flutter/material.dart';
import '../../models/visit.dart';
import '../../screens/Visit/visit_details.dart';

class VisitItem extends StatelessWidget {
  final Visit visit;

  const VisitItem(this.visit, {super.key});

  @override
  Widget build(BuildContext context) {
    // Format the date and time
    String formattedDate = visit.date != null
        ? '${visit.date!.day}/${visit.date!.month}/${visit.date!.year}'
        : 'N/A';
    String formattedTime = visit.time != null
        ? visit.time!.split(':').take(2).join(':') // Remove seconds
        : 'N/A';

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
      elevation: 3,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => VisitDetailsScreen(visit: visit),
            ),
          );
        },
        borderRadius: BorderRadius.circular(12),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Colors.white, Color(0xFFF5F5F5)],
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Visit Details',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4CB1C7)),
                    ),
                    Chip(
                      label: Text(
                        visit.status ?? 'Unknown',
                        style: TextStyle(fontSize: 12, color: _getStatusColor(visit.status), fontWeight: FontWeight.bold),
                      ),
                      backgroundColor: _getStatusColor(visit.status)?.withOpacity(0.2),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ],
                ),
                SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.location_on, size: 16, color: Colors.grey),
                    SizedBox(width: 4),
                    Text(
                      'Location: ${visit.location ?? 'N/A'}',
                      style: TextStyle(fontSize: 14, color: Colors.grey[700]),
                    ),
                  ],
                ),

                SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.access_time, size: 16, color: Colors.grey),
                    SizedBox(width: 4),
                    Text(
                      'Time: $formattedTime',
                      style: TextStyle(fontSize: 14, color: Colors.grey[700]),
                    ),
                  ],
                ),
                SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: (visit.reasons ?? []).map((reason) {
                    return Chip(
                      label: Text(reason as String, style: TextStyle(fontSize: 12, color: Colors.blue)),
                      backgroundColor: Colors.blue.withOpacity(0.2),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    );
                  }).toList(),
                ),
              ],
            ),
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