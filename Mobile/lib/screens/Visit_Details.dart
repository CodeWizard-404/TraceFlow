// lib/screens/visit_details_screen.dart
import 'package:flutter/material.dart';
import '../services/backend_service.dart';

class VisitDetailsScreen extends StatelessWidget {
  final Map<String, dynamic> visit;

  VisitDetailsScreen({required this.visit});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Visit Details")),
      body: Column(
        children: [
          Text('Reason: ${visit['reason']}'),
          ElevatedButton(
            onPressed: () async {
              await BackendService.logVisit(
                visitID: visit['visitID'],
                reason: 'Training',
                checklist: ['Task 1', 'Task 2'],
                photos: [],
                comment: 'Completed successfully',
              );
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Visit logged successfully')),
              );
            },
            child: Text('Log Visit'),
          ),
        ],
      ),
    );
  }
}