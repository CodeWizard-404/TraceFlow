import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

class AgentDetailsSheet extends StatelessWidget {
  final dynamic agent;

  const AgentDetailsSheet({super.key, required this.agent});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      height: 200,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${agent.name} ${agent.lastname}', style: Theme.of(context).textTheme.titleLarge),
          Text(agent.location ?? 'Unknown', style: Theme.of(context).textTheme.bodyMedium),
          Text('Phone: ${agent.phone}'),
          const Spacer(),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              ElevatedButton.icon(
                onPressed: () => _getDirections(context, agent),
                icon: const Icon(Icons.directions),
                label: const Text('Directions'),
              ),
              ElevatedButton.icon(
                onPressed: () => _callAgent(agent.phone),
                icon: const Icon(Icons.phone),
                label: const Text('Call'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _getDirections(BuildContext context, dynamic agent) {
    // Implement directions (see Directions section)
  }

  void _callAgent(String phone) {
    // Use url_launcher to make a phone call
  }
}