import 'package:flutter/material.dart';

class Timesheet extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Timesheet Management')),
      body: Column(
        children: [
          ElevatedButton(
            onPressed: () {
              // Navigate to add visit screen
            },
            child: Text('Add Visit'),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: 10, // Example data
              itemBuilder: (context, index) {
                return ListTile(
                  title: Text('Visit $index'),
                  onTap: () {
                    // Navigate to visit details screen
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}