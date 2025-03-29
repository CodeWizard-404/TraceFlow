// lib/screens/Visit/create_visit.dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../models/checklist.dart';
import '../../models/reason.dart';
import '../../models/agent.dart';
import '../../providers/auth_provider.dart';
import '../../providers/agent_provider.dart';
import '../../providers/checklist_provider.dart';
import '../../providers/reason_provider.dart';
import '../../providers/timesheet_provider.dart';
import '../Error.dart';

class CreateVisitScreen extends StatefulWidget {
  final int weekNumber;
  final int year;

  const CreateVisitScreen({
    super.key,
    required this.weekNumber,
    required this.year,
  });

  @override
  _CreateVisitScreenState createState() => _CreateVisitScreenState();
}

class _CreateVisitScreenState extends State<CreateVisitScreen> {
  final _formKey = GlobalKey<FormState>();
  List<Map<String, dynamic>> _visits = [];
  DateTime? _selectedDate;
  TimeOfDay? _selectedTime;
  String? _selectedAgentId;
  List<String> _selectedChecklistIds = [];
  List<String> _selectedReasonIds = [];
  String? _location;
  String? _phoneError;
  Timer? _debounce;
  final TextEditingController _phoneController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _selectedDate = DateTime(widget.year, 1, 1).add(Duration(days: (widget.weekNumber - 1) * 7));
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (authProvider.token != null) {
      Provider.of<AgentProvider>(context, listen: false)
          .fetchUniqueLocations(authProvider.token!)
          .catchError((e) => _showError(e));
      Provider.of<ChecklistProvider>(context, listen: false)
          .getAllChecklists(authProvider.token!)
          .catchError((e) => _showError(e));
      Provider.of<ReasonProvider>(context, listen: false)
          .getAllReasons(authProvider.token!)
          .catchError((e) => _showError(e));
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _phoneController.dispose();
    super.dispose();
  }

  void _showError(dynamic error) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ErrorPage(errorMessage: 'Error: $error', onRetry: () => Navigator.pop(context)),
      ),
    );
  }

  Future<void> _selectDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now(),
      firstDate: DateTime(widget.year),
      lastDate: DateTime(widget.year + 1),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: Theme.of(context).colorScheme,
        ),
        child: child!,
      ),
    );
    if (picked != null && picked != _selectedDate) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _selectTime(BuildContext context) async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: _selectedTime ?? TimeOfDay.now(),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: Theme.of(context).colorScheme,
        ),
        child: child!,
      ),
    );
    if (picked != null && picked != _selectedTime) {
      setState(() => _selectedTime = picked);
    }
  }

  void _addVisit() {
    if (_formKey.currentState!.validate() && _selectedDate != null && _selectedTime != null) {
      final visit = {
        'date': _selectedDate!.toIso8601String(),
        'time': _selectedTime!.format(context),
        'location': _location,
        'agentID': _selectedAgentId,
        'checklists': _selectedChecklistIds.map((id) => {'checklistID': id, 'checked': false}).toList(),
        'reasons': _selectedReasonIds.map((id) => {'reasonID': id}).toList(),
        'status': 'pending',
      };
      setState(() {
        _visits.add(visit);
        _selectedAgentId = null;
        _selectedChecklistIds.clear();
        _selectedReasonIds.clear();
        _location = null;
        _phoneController.clear();
      });
    }
  }

  void _submitTimesheet() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);
    if (_visits.isNotEmpty && authProvider.token != null && authProvider.user?.userID != null) {
      timesheetProvider
          .createTimesheet(
        weekNumber: widget.weekNumber,
        year: widget.year,
        supervisorID: authProvider.user!.userID!,
        visits: _visits,
        token: authProvider.token!,
      )
          .then((_) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Timesheet created successfully')),
        );
        Navigator.pop(context);
      }).catchError((e) {
        _showError(e);
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add at least one visit to create a timesheet')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final agentProvider = Provider.of<AgentProvider>(context);
    final checklistProvider = Provider.of<ChecklistProvider>(context);
    final reasonProvider = Provider.of<ReasonProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Timesheet'),
        backgroundColor: Theme.of(context).colorScheme.primary,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Week ${widget.weekNumber}, ${widget.year}', style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 16),
                // Date Picker
                ListTile(
                  title: Text(_selectedDate == null
                      ? 'Select Date'
                      : DateFormat('yyyy-MM-dd').format(_selectedDate!)),
                  trailing: const Icon(Icons.calendar_today),
                  onTap: () => _selectDate(context),
                ),
                // Time Picker
                ListTile(
                  title: Text(_selectedTime == null ? 'Select Time' : _selectedTime!.format(context)),
                  trailing: const Icon(Icons.access_time),
                  onTap: () => _selectTime(context),
                ),
                // Agent Selection
                DropdownButtonFormField<String>(
                  value: _selectedAgentId,
                  hint: const Text('Select Agent'),
                  items: agentProvider.agents
                      .map((agent) => DropdownMenuItem(
                            value: agent.agentID,
                            child: Text('${agent.name} ${agent.lastname}'),
                          ))
                      .toList(),
                  onChanged: (value) => setState(() => _selectedAgentId = value),
                  validator: (value) => value == null ? 'Please select an agent' : null,
                ),
                const SizedBox(height: 16),
                // Location
                TextFormField(
                  decoration: const InputDecoration(labelText: 'Location'),
                  onChanged: (value) => _location = value,
                  validator: (value) => value!.isEmpty ? 'Please enter a location' : null,
                ),
                // Checklists
                const SizedBox(height: 16),
                Text('Checklists', style: Theme.of(context).textTheme.headlineSmall),
                ...checklistProvider.checklists.map((checklist) => CheckboxListTile(
                      title: Text(checklist.item ?? ''),
                      value: _selectedChecklistIds.contains(checklist.checklistID),
                      onChanged: (bool? value) {
                        setState(() {
                          if (value == true) {
                            _selectedChecklistIds.add(checklist.checklistID!);
                          } else {
                            _selectedChecklistIds.remove(checklist.checklistID!);
                          }
                        });
                      },
                    )),
                // Reasons
                const SizedBox(height: 16),
                Text('Reasons', style: Theme.of(context).textTheme.headlineSmall),
                ...reasonProvider.reasons.map((reason) => CheckboxListTile(
                      title: Text(reason.item ?? ''),
                      value: _selectedReasonIds.contains(reason.reasonID),
                      onChanged: (bool? value) {
                        setState(() {
                          if (value == true) {
                            _selectedReasonIds.add(reason.reasonID!);
                          } else {
                            _selectedReasonIds.remove(reason.reasonID!);
                          }
                        });
                      },
                    )),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _addVisit,
                  child: const Text('Add Visit'),
                ),
                const SizedBox(height: 16),
                Text('Visits Added: ${_visits.length}', style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _submitTimesheet,
                  child: const Text('Create Timesheet'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}