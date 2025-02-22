import 'package:flutter/material.dart';

class ReasonSelection extends StatelessWidget {
  final List<String> reasons = ['Reason 1', 'Reason 2', 'Reason 3'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Select Visit Reasons')),
      body: ListView.builder(
        itemCount: reasons.length,
        itemBuilder: (context, index) {
          return ListTile(
            title: Text(reasons[index]),
            onTap: () {
              // Handle reason selection
              Navigator.pop(context, reasons[index]);
            },
          );
        },
      ),
    );
  }
}