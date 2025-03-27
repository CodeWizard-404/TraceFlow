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

  Future<void> _showLocationDialog(BuildContext context, AgentProvider agentProvider) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final locations = agentProvider.uniqueLocations;
    final TextEditingController searchController = TextEditingController();
    List<String> filteredLocations = List.from(locations);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text('Select Location', style: Theme.of(context).textTheme.headlineSmall),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: searchController,
                      decoration: InputDecoration(
                        hintText: 'Search locations...',
                        prefixIcon: Icon(Icons.search, color: Theme.of(context).colorScheme.primary),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onChanged: (value) {
                        setDialogState(() {
                          filteredLocations = locations
                              .where((location) => location.toLowerCase().contains(value.toLowerCase()))
                              .toList();
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 300,
                      child: ListView.builder(
                        itemCount: filteredLocations.length,
                        itemBuilder: (context, index) {
                          final location = filteredLocations[index];
                          return RadioListTile<String>(
                            title: Text(location),
                            value: location,
                            groupValue: _location,
                            onChanged: (value) {
                              setDialogState(() => _location = value);
                              setState(() {
                                _location = value;
                                _selectedAgentId = null;
                              });
                              if (authProvider.token != null) {
                                agentProvider.fetchAgentsByLocation(value!, authProvider.token!);
                              }
                              Navigator.pop(context);
                            },
                            activeColor: Theme.of(context).colorScheme.primary,
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text('Cancel', style: Theme.of(context).textTheme.bodyMedium),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _showAgentDialog(BuildContext context, AgentProvider agentProvider) async {
    final agents = agentProvider.agents;
    final TextEditingController searchController = TextEditingController();
    List<Agent> filteredAgents = List.from(agents);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text('Select Agent', style: Theme.of(context).textTheme.headlineSmall),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: searchController,
                      decoration: InputDecoration(
                        hintText: 'Search agents...',
                        prefixIcon: Icon(Icons.search, color: Theme.of(context).colorScheme.primary),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onChanged: (value) {
                        setDialogState(() {
                          filteredAgents = agents
                              .where((agent) =>
                          (agent.name?.toLowerCase().contains(value.toLowerCase()) ?? false) ||
                              (agent.lastname?.toLowerCase().contains(value.toLowerCase()) ?? false))
                              .toList();
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 300,
                      child: ListView.builder(
                        itemCount: filteredAgents.length,
                        itemBuilder: (context, index) {
                          final agent = filteredAgents[index];
                          return RadioListTile<String>(
                            title: Text('${agent.name ?? ''} ${agent.lastname ?? ''}'),
                            subtitle: Text(agent.phone ?? ''),
                            value: agent.agentID!,
                            groupValue: _selectedAgentId,
                            onChanged: (value) {
                              setState(() => _selectedAgentId = value);
                              Navigator.pop(context);
                            },
                            activeColor: Theme.of(context).colorScheme.primary,
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text('Cancel', style: Theme.of(context).textTheme.bodyMedium),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _onPhoneChanged(String value) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () async {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (value.length >= 10 && authProvider.token != null) {
        try {
          final agent = await Provider.of<AgentProvider>(context, listen: false)
              .fetchAgentByPhone(value, authProvider.token!);
          setState(() {
            _selectedAgentId = agent.agentID;
            _location = agent.location;
            _phoneError = null;
          });
        } catch (e) {
          setState(() {
            _phoneError = 'Agent not found';
            _selectedAgentId = null;
          });
        }
      }
    });
  }

  Future<void> _submitForm() async {
    if (_formKey.currentState!.validate()) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);
      if (authProvider.token == null || authProvider.user?.userID == null) {
        _showError('Please log in first');
        return;
      }

      final visitData = {
        'date': _selectedDate?.toIso8601String().split('T')[0],
        'time': _selectedTime?.format(context),
        'location': _location,
        'agentID': _selectedAgentId,
        'checklists': _selectedChecklistIds.map((id) => {'checklistID': id, 'checked': false}).toList(),
        'reasons': _selectedReasonIds.map((id) => {'reasonID': id}).toList(),
        'status': 'pending',
      };

      try {
        await timesheetProvider.createTimesheet(
          weekNumber: widget.weekNumber,
          year: widget.year,
          supervisorID: authProvider.user!.userID!,
          visits: [visitData],
          token: authProvider.token!,
        );
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Visit created successfully'),
            backgroundColor: Theme.of(context).colorScheme.primary,
          ),
        );
      } catch (e) {
        _showError('Failed to create visit: $e');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final agentProvider = Provider.of<AgentProvider>(context);
    final checklistProvider = Provider.of<ChecklistProvider>(context);
    final reasonProvider = Provider.of<ReasonProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Visit'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextFormField(
                  controller: _phoneController,
                  decoration: InputDecoration(
                    labelText: 'Agent Phone',
                    errorText: _phoneError,
                  ),
                  keyboardType: TextInputType.phone,
                  onChanged: _onPhoneChanged,
                ),
                const SizedBox(height: 16),
                ListTile(
                  title: Text(
                    _selectedDate == null
                        ? 'Select Date'
                        : DateFormat('yyyy-MM-dd').format(_selectedDate!),
                  ),
                  trailing: const Icon(Icons.calendar_today),
                  onTap: () => _selectDate(context),
                ),
                ListTile(
                  title: Text(
                    _selectedTime == null ? 'Select Time' : _selectedTime!.format(context),
                  ),
                  trailing: const Icon(Icons.access_time),
                  onTap: () => _selectTime(context),
                ),
                ListTile(
                  title: Text(_location ?? 'Select Location'),
                  trailing: const Icon(Icons.location_on),
                  onTap: () => _showLocationDialog(context, agentProvider),
                ),
                if (_location != null)
                  ListTile(
                    title: Text(
                      _selectedAgentId == null ? 'Select Agent' : 'Agent: $_selectedAgentId',
                    ),
                    trailing: const Icon(Icons.person),
                    onTap: () => _showAgentDialog(context, agentProvider),
                  ),
                const SizedBox(height: 16),
                Text('Checklists', style: Theme.of(context).textTheme.headlineSmall),
                ...checklistProvider.checklists.map((checklist) {
                  return CheckboxListTile(
                    title: Text(checklist.item ?? ''),
                    value: _selectedChecklistIds.contains(checklist.checklistID),
                    onChanged: (bool? value) {
                      setState(() {
                        if (value == true) {
                          _selectedChecklistIds.add(checklist.checklistID!);
                        } else {
                          _selectedChecklistIds.remove(checklist.checklistID);
                        }
                      });
                    },
                  );
                }),
                const SizedBox(height: 16),
                Text('Reasons', style: Theme.of(context).textTheme.headlineSmall),
                ...reasonProvider.reasons.map((reason) {
                  return CheckboxListTile(
                    title: Text(reason.item ?? ''),
                    value: _selectedReasonIds.contains(reason.reasonID),
                    onChanged: (bool? value) {
                      setState(() {
                        if (value == true) {
                          _selectedReasonIds.add(reason.reasonID!);
                        } else {
                          _selectedReasonIds.remove(reason.reasonID);
                        }
                      });
                    },
                  );
                }),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _submitForm,
                  style: Theme.of(context).elevatedButtonTheme.style,
                  child: const Text('Create Visit'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}