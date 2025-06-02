import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../models/visit.dart';
import '../../providers/agent_provider.dart';
import '../../screens/Visit/visit_details.dart';

class VisitItem extends StatelessWidget {
  final Visit visit;

  const VisitItem({super.key, required this.visit});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Consumer<AgentProvider>(
      builder: (context, agentProvider, child) {
        final agent = agentProvider.currentAgent;

        return Card(
          elevation: 2,
          margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: ListTile(
            contentPadding: const EdgeInsets.all(16),
            title: Text(
              agent != null ? '${agent.name} ${agent.lastname}' : 'Agent: ${visit.agentID}',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 8),
                Text(
                  'Date: ${DateFormat('yyyy-MM-dd').format(visit.date)}',
                  style: theme.textTheme.bodyMedium,
                ),
                Text(
                  'Time: ${visit.time}',
                  style: theme.textTheme.bodyMedium,
                ),
                Text(
                  'Location: ${visit.location ?? 'N/A'}',
                  style: theme.textTheme.bodyMedium,
                ),
                Text(
                  'Status: ${visit.status?.toUpperCase() ?? 'N/A'}',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: visit.status == 'visited' ? Colors.green : Colors.orange,
                  ),
                ),
              ],
            ),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => VisitDetailsScreen(visit: visit),
                ),
              );
            },
          ),
        );
      },
    );
  }
}