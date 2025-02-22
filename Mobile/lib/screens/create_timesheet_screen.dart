import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/timesheet_provider.dart';

class CreateTimesheetScreen extends StatefulWidget {
  const CreateTimesheetScreen({super.key});

  @override
  CreateTimesheetScreenState createState() => CreateTimesheetScreenState();
}

class CreateTimesheetScreenState extends State<CreateTimesheetScreen> {
  final _formKey = GlobalKey<FormState>();
  late int _weekNumber;
  late int _year;
  List<Map<String, dynamic>> _visits = []; // To store visits

  void _addVisit(Map<String, dynamic> visit) {
    setState(() {
      _visits.add(visit);
    });
  }

  @override
  Widget build(BuildContext context) {
    final timesheetProvider = Provider.of<TimesheetProvider>(context);

    return Scaffold(
      appBar: AppBar(title: Text('Create Timesheet')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                decoration: InputDecoration(labelText: 'Week Number'),
                keyboardType: TextInputType.number,
                validator: (value) => value!.isEmpty ? 'Enter week number' : null,
                onSaved: (value) => _weekNumber = int.parse(value!),
              ),
              TextFormField(
                decoration: InputDecoration(labelText: 'Year'),
                keyboardType: TextInputType.number,
                validator: (value) => value!.isEmpty ? 'Enter year' : null,
                onSaved: (value) => _year = int.parse(value!),
              ),
              SizedBox(height: 20),
              ElevatedButton(
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (context) => AddVisitDialog(onAddVisit: _addVisit),
                  );
                },
                child: Text('Add Visit'),
              ),
              SizedBox(height: 20),
              Expanded(
                child: ListView.builder(
                  itemCount: _visits.length,
                  itemBuilder: (context, index) {
                    final visit = _visits[index];
                    return ListTile(
                      title: Text('${visit['date']} - ${visit['location']}'),
                      subtitle: Text('Agent ID: ${visit['agentID']}'),
                    );
                  },
                ),
              ),
              ElevatedButton(
                onPressed: () async {
                  if (_formKey.currentState!.validate()) {
                    _formKey.currentState?.save();
                    await timesheetProvider.createTimesheet(
                      _weekNumber,
                      _year,
                      '1', // Hardcoded supervisorID
                      _visits, // Pass the list of visits
                    );
                    if (mounted) {
                      Navigator.pop(context);
                    }
                  }
                },
                child: Text('Create Timesheet'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// Dialog to add a new visit
class AddVisitDialog extends StatelessWidget {
  final Function(Map<String, dynamic>) onAddVisit;

  AddVisitDialog({required this.onAddVisit});

  final _formKey = GlobalKey<FormState>();
  late String _date;
  late String _time;
  late String _location;
  late String _agentID;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Add Visit'),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              decoration: InputDecoration(labelText: 'Date'),
              validator: (value) => value!.isEmpty ? 'Enter date' : null,
              onSaved: (value) => _date = value!,
            ),
            TextFormField(
              decoration: InputDecoration(labelText: 'Time'),
              validator: (value) => value!.isEmpty ? 'Enter time' : null,
              onSaved: (value) => _time = value!,
            ),
            TextFormField(
              decoration: InputDecoration(labelText: 'Location'),
              validator: (value) => value!.isEmpty ? 'Enter location' : null,
              onSaved: (value) => _location = value!,
            ),
            TextFormField(
              decoration: InputDecoration(labelText: 'Agent ID'),
              validator: (value) => value!.isEmpty ? 'Enter agent ID' : null,
              onSaved: (value) => _agentID = value!,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () {
            if (_formKey.currentState!.validate()) {
              _formKey.currentState?.save();
              onAddVisit({
                'date': _date,
                'time': _time,
                'location': _location,
                'agentID': _agentID,
              });
              Navigator.pop(context);
            }
          },
          child: Text('Add'),
        ),
      ],
    );
  }
}