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
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 1),
      child: GestureDetector(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => VisitDetailsScreen(visit: visit)),
          );
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
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
            border: Border.all(
              color: Theme.of(context).colorScheme.primary.withOpacity(0.5),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Text(
                        'Visit Details',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                    ),
                    GlassStatusChip(
                      status: visit.status ?? 'Unknown',
                      color: _getStatusColor(context, visit.status),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                _buildInfoRow(
                  context,
                  Icons.location_on,
                  'Location: ${visit.location ?? 'N/A'}',
                ),
                const SizedBox(height: 12),
                _buildInfoRow(
                  context,
                  Icons.access_time,
                  'Time: $formattedTime',
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children:
                      (visit.reasons ?? [])
                          .map(
                            (reason) => GlassChip(label: reason.item ?? 'N/A'),
                          )
                          .toList(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(BuildContext context, IconData icon, String text) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
          ),
          child: Icon(
            icon,
            size: 18,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
        ),
      ],
    );
  }

  Color? _getStatusColor(BuildContext context, String? status) {
    switch (status?.toLowerCase()) {
      case 'visited':
        return Colors.lightBlue;
      case 'pending':
        return Colors.orange;
      case 'rejected':
        return Colors.red;
      case 'validated':
        return Colors.pink;
      default:
        return Theme.of(context).colorScheme.onSurface.withOpacity(0.6);
    }
  }
}
