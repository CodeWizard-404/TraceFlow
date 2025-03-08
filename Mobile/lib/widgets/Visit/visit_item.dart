import 'package:flutter/material.dart';
import '../../models/visit.dart';
import '../../screens/Visit/visit_details.dart';
import '../Glass_Effect/GlassChip.dart';
import '../Glass_Effect/GlassStatusChip.dart';

class VisitItem extends StatelessWidget {
  final Visit visit;

  const VisitItem(this.visit, {super.key});

  @override
  Widget build(BuildContext context) {
    String formattedTime = visit.time?.split(':').take(2).join(':') ?? 'N/A';

    return Padding(
      padding: EdgeInsets.symmetric(vertical: 8, horizontal: 1),
      child: GestureDetector(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => VisitDetailsScreen(visit: visit),
            ),
          );
        },
        child: AnimatedContainer(
          duration: Duration(milliseconds: 300),
          curve: Curves.easeInOut,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.white.withOpacity(0.9),
                Colors.grey[50]!.withOpacity(0.9),
              ],
            ),
            border: Border.all(
              color: Color(0xFF4CB1C7).withOpacity(0.5), // Border color
              width: 1, // Border width
            ),
            boxShadow: [
              BoxShadow(
                color: Color(0xFF4CB1C7).withOpacity(0.1),
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
                    Flexible(
                      child: Text(
                        'Visit Details',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF4CB1C7),
                          shadows: [Shadow(color: Colors.black12, blurRadius: 2)],
                        ),
                      ),
                    ),
                    GlassStatusChip(
                      status: visit.status ?? 'Unknown',
                      color: _getStatusColor(visit.status),
                    ),
                  ],
                ),
                SizedBox(height: 16),
                _buildInfoRow(Icons.location_on, 'Location: ${visit.location ?? 'N/A'}'),
                SizedBox(height: 12),
                _buildInfoRow(Icons.access_time, 'Time: $formattedTime'),
                SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: (visit.reasons ?? [])
                      .map((reason) => GlassChip(
                    label: reason.item ?? 'N/A',
                  ))
                      .toList(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String text) {
    return Row(
      children: [
        Container(
          padding: EdgeInsets.all(6),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Color(0xFF4CB1C7).withOpacity(0.1),
          ),
          child: Icon(icon, size: 18, color: Color(0xFF4CB1C7)),
        ),
        SizedBox(width: 12),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 15,
              color: Colors.grey[800],
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }

  Color? _getStatusColor(String? status) {
    switch (status?.toLowerCase()) {
      case 'visited':
        return Colors.green;
      case 'pending':
        return Colors.orange;
      case 'rejected':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }
}