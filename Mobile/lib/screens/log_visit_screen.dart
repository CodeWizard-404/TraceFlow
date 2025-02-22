import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/visit_provider.dart';
import '../widgets/qr_scanner_widget.dart';

class LogVisitScreen extends StatefulWidget {
  const LogVisitScreen({super.key});

  @override
  LogVisitScreenState createState() => LogVisitScreenState();
}

class LogVisitScreenState extends State<LogVisitScreen> {
  String? _agentID;
  final List<String> _selectedReasons = [];
  final List<String> _checklist = [];
  final List<String> _reasons = ['Meeting', 'Inspection', 'Training', 'Other'];

  @override
  Widget build(BuildContext context) {
    final visitProvider = Provider.of<VisitProvider>(context);

    return Scaffold(
      appBar: AppBar(title: Text('Log Visit')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            if (_agentID == null)
              ElevatedButton(
                onPressed: () async {
                  final result = await Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => QRScannerWidget()),
                  );
                  if (result != null) {
                    setState(() {
                      _agentID = result;
                      visitProvider.startVisitTimer();
                    });
                  }
                },
                child: Text('Scan QR Code'),
              ),
            if (_agentID != null) ...[
              Text('Agent ID: $_agentID'),
              Wrap(
                spacing: 8.0,
                children: _reasons.map((reason) {
                  return FilterChip(
                    label: Text(reason),
                    selected: _selectedReasons.contains(reason),
                    onSelected: (isSelected) {
                      setState(() {
                        if (isSelected) {
                          _selectedReasons.add(reason);
                        } else {
                          _selectedReasons.remove(reason);
                        }
                      });
                    },
                  );
                }).toList(),
              ),
              CheckboxListTile(
                title: Text('Task 1 Completed'),
                value: _checklist.contains('Task 1'),
                onChanged: (value) => setState(() {
                  if (value!) {
                    _checklist.add('Task 1');
                  } else {
                    _checklist.remove('Task 1');
                  }
                }),
              ),
              CheckboxListTile(
                title: Text('Task 2 Completed'),
                value: _checklist.contains('Task 2'),
                onChanged: (value) => setState(() {
                  if (value!) {
                    _checklist.add('Task 2');
                  } else {
                    _checklist.remove('Task 2');
                  }
                }),
              ),
              SizedBox(height: 20),
              ElevatedButton(
                onPressed: () async {
                  final duration = visitProvider.stopVisitTimer();
                  final visitID = DateTime.now().millisecondsSinceEpoch.toString(); // Generate unique visitID
                  final logData = {
                    'reason': _selectedReasons.join(', '), // Combine reasons into a string
                    'checklist': _checklist,
                    'duration': duration,
                    'status': 'Visited',

                  };
                  await visitProvider.logVisit(visitID, logData);
                  Navigator.pop(context);
                },
                child: Text('Validate Visit'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}