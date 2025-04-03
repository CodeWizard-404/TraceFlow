import 'package:flutter/material.dart';
import '../../models/visit.dart';
import '../../screens/visit/visit_details.dart';
import '../commen/info_row.dart';

class VisitItem extends StatelessWidget {
  final Visit visit;

  const VisitItem(this.visit, {super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    String formattedTime = visit.time?.split(':').take(2).join(':') ?? 'N/A';
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => VisitDetailsScreen(visit: visit)),
      ),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        child: Card(
          elevation: 2,
          color: theme.cardTheme.color, // #F9FAFB or #1F262D
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Visit Details',
                      style: theme.textTheme.headlineSmall, // Black/gray
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: _getStatusColor(context, visit.status).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        visit.status ?? 'Unknown',
                        style: TextStyle(
                          fontSize: 12,
                          color: _getStatusColor(context, visit.status),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                InfoRow(
                  icon: Icons.location_on,
                  text: 'Location: ${visit.location ?? 'N/A'}',
                ),
                const SizedBox(height: 8),
                InfoRow(
                  icon: Icons.access_time,
                  text: 'Time: $formattedTime',
                ),
                if (visit.reasons != null && visit.reasons!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: visit.reasons!
                        .map(
                          (reason) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.onSurface.withOpacity(0.1), // Gray tint
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          reason.item ?? 'N/A',
                          style: TextStyle(
                            fontSize: 12,
                            color: theme.colorScheme.onSurface, // Black/gray
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    )
                        .toList(),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Color _getStatusColor(BuildContext context, String? status) {
    switch (status?.toLowerCase()) {
      case 'visited':
        return Theme.of(context).colorScheme.primary; // #63b3ed or #4cb1c7
      case 'pending':
        return const Color(0xFFF4B400); // Yellow
      case 'rejected':
        return const Color(0xFFD93025); // Red
      case 'validated':
        return const Color(0xFF2EA44F); // Blue-green (your call if this stays)
      default:
        return Theme.of(context).colorScheme.onSurface.withOpacity(0.6); // Gray
    }
  }
}