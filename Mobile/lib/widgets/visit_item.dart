import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/visit.dart';

class VisitItem extends StatelessWidget {
  final Visit visit;

  const VisitItem(this.visit, {super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        title: Text(
          'Visit #${visit.visitID}',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: visit.status == 'validated' ? Colors.green : Colors.orange,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 8),
            _buildDetailRow('Agent:', visit.agentID!),
            _buildDetailRow('Date:', DateFormat('MMM dd, yyyy').format(visit.date!)),
            _buildDetailRow('Time:', visit.time!),
            _buildDetailRow('Location:', visit.location!),
            _buildDetailRow('Status:', visit.status!.toUpperCase()),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w500),
          ),
          const SizedBox(width: 8),
          Text(value),
        ],
      ),
    );
  }
}