import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:visit_management/models/checklist.dart';
import 'package:visit_management/models/reason.dart';
import 'package:visit_management/models/agent.dart';
import 'package:visit_management/providers/agent_provider.dart';
import 'package:visit_management/providers/checklist_provider.dart';
import 'package:visit_management/providers/reason_provider.dart';
import 'package:visit_management/providers/timesheet_provider.dart';

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
  String _agentPhone = '';
  String? _phoneError;
  Timer? _debounce;
  final TextEditingController _phoneController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _selectedDate = DateTime(widget.year, 1, 1).add(Duration(days: (widget.weekNumber - 1) * 7));
    Provider.of<AgentProvider>(context, listen: false).fetchUniqueLocations();
    Provider.of<ChecklistProvider>(context, listen: false).getAllChecklists();
    Provider.of<ReasonProvider>(context, listen: false).getAllReasons();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _phoneController.dispose();
    super.dispose();
  }

  int _getWeekNumber(DateTime date) {
    final startOfYear = DateTime(date.year, 1, 1);
    return (date.difference(startOfYear).inDays / 7).ceil();
  }

  Future<void> _selectDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now(),
      firstDate: DateTime(widget.year),
      lastDate: DateTime(widget.year + 1),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: Theme.of(context).colorScheme.copyWith(
              primary: Theme.of(context).colorScheme.primary,
              onPrimary: Theme.of(context).colorScheme.onPrimary,
              surface: Theme.of(context).colorScheme.surface,
              onSurface: Theme.of(context).colorScheme.onSurface,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null && picked != _selectedDate) {
      setState(() {
        _selectedDate = picked;
      });
    }
  }

  Future<void> _selectTime(BuildContext context) async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: _selectedTime ?? TimeOfDay.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: Theme.of(context).colorScheme.copyWith(
              primary: Theme.of(context).colorScheme.primary,
              onPrimary: Theme.of(context).colorScheme.onPrimary,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null && picked != _selectedTime) {
      setState(() {
        _selectedTime = picked;
      });
    }
  }

  Future<void> _showLocationDialog(BuildContext context, AgentProvider agentProvider) async {
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
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
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
                              setDialogState(() {
                                _location = value;
                              });
                              setState(() {
                                _location = value;
                                _selectedAgentId = null;
                              });
                              agentProvider.fetchAgentsByLocation(value!);
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
                  child: Text('Cancel', style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6))),
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
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onChanged: (value) {
                        setDialogState(() {
                          filteredAgents = agents
                              .where((agent) =>
                          '${agent.name} ${agent.lastname}'.toLowerCase().contains(value.toLowerCase()) ||
                              agent.agentID!.toLowerCase().contains(value.toLowerCase()))
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
                            title: Text('${agent.name} ${agent.lastname}'),
                            value: agent.agentID!,
                            groupValue: _selectedAgentId,
                            onChanged: (value) {
                              setDialogState(() {
                                _selectedAgentId = value;
                              });
                              setState(() {
                                _selectedAgentId = value;
                              });
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
                  child: Text('Cancel', style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6))),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _showChecklistDialog(BuildContext context, ChecklistProvider checklistProvider) async {
    final allChecklists = await checklistProvider.getAllChecklists();
    final selectedIds = List<String>.from(_selectedChecklistIds);
    final TextEditingController searchController = TextEditingController();
    List<Checklist> filteredChecklists = List.from(allChecklists);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text('Select Checklists', style: Theme.of(context).textTheme.headlineSmall),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: searchController,
                      decoration: InputDecoration(
                        hintText: 'Search checklists...',
                        prefixIcon: Icon(Icons.search, color: Theme.of(context).colorScheme.primary),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onChanged: (value) {
                        setDialogState(() {
                          filteredChecklists = allChecklists
                              .where((checklist) =>
                              (checklist.item ?? '').toLowerCase().contains(value.toLowerCase()))
                              .toList();
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 300,
                      child: ListView.builder(
                        itemCount: filteredChecklists.length,
                        itemBuilder: (context, index) {
                          final checklist = filteredChecklists[index];
                          final isSelected = selectedIds.contains(checklist.checklistID);
                          return CheckboxListTile(
                            title: Text(checklist.item ?? ''),
                            value: isSelected,
                            onChanged: (value) {
                              setDialogState(() {
                                if (value == true) {
                                  selectedIds.add(checklist.checklistID!);
                                } else {
                                  selectedIds.remove(checklist.checklistID);
                                }
                              });
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
                  child: Text('Cancel', style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6))),
                ),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _selectedChecklistIds = selectedIds;
                    });
                    Navigator.pop(context);
                  },
                  style: Theme.of(context).elevatedButtonTheme.style,
                  child: Text('Confirm', style: TextStyle(color: Theme.of(context).colorScheme.onPrimary)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _showReasonDialog(BuildContext context, ReasonProvider reasonProvider) async {
    final allReasons = await reasonProvider.getAllReasons();
    final selectedIds = List<String>.from(_selectedReasonIds);
    final TextEditingController searchController = TextEditingController();
    List<Reason> filteredReasons = List.from(allReasons);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text('Select Reasons', style: Theme.of(context).textTheme.headlineSmall),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: searchController,
                      decoration: InputDecoration(
                        hintText: 'Search reasons...',
                        prefixIcon: Icon(Icons.search, color: Theme.of(context).colorScheme.primary),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onChanged: (value) {
                        setDialogState(() {
                          filteredReasons = allReasons
                              .where((reason) =>
                              (reason.item ?? '').toLowerCase().contains(value.toLowerCase()))
                              .toList();
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 300,
                      child: ListView.builder(
                        itemCount: filteredReasons.length,
                        itemBuilder: (context, index) {
                          final reason = filteredReasons[index];
                          final isSelected = selectedIds.contains(reason.reasonID);
                          return CheckboxListTile(
                            title: Text(reason.item ?? ''),
                            value: isSelected,
                            onChanged: (value) {
                              setDialogState(() {
                                if (value == true) {
                                  selectedIds.add(reason.reasonID!);
                                } else {
                                  selectedIds.remove(reason.reasonID);
                                }
                              });
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
                  child: Text('Cancel', style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6))),
                ),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _selectedReasonIds = selectedIds;
                    });
                    Navigator.pop(context);
                  },
                  style: Theme.of(context).elevatedButtonTheme.style,
                  child: Text('Confirm', style: TextStyle(color: Theme.of(context).colorScheme.onPrimary)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _onPhoneChanged(String value, AgentProvider agentProvider) {
    setState(() {
      _agentPhone = value;
      _phoneError = null;
    });

    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () async {
      if (value.isEmpty) {
        setState(() {
          _selectedAgentId = null;
          _location = null;
          agentProvider.agents.clear();
        });
      } else if (value.length >= 7) {
        try {
          final agent = await agentProvider.fetchAgentByPhone(value);
          setState(() {
            _selectedAgentId = agent.agentID;
            _location = agent.location;
            agentProvider.agents.clear();
            agentProvider.agents.add(agent);
          });
        } catch (e) {
          setState(() {
            _phoneError = 'Agent not found with this phone number';
            _selectedAgentId = null;
            _location = null;
            agentProvider.agents.clear();
          });
        }
      }
    });
  }

  void _submitVisit() async {
    if (_formKey.currentState!.validate()) {
      if (_selectedDate == null || _selectedTime == null || _selectedAgentId == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Please fill all required fields'), backgroundColor: Theme.of(context).colorScheme.error),
        );
        return;
      }

      final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);

      try {
        List<Map<String, String>> checklists = _selectedChecklistIds.map((id) => {'id': id}).toList();
        List<Map<String, String>> reasons = _selectedReasonIds.map((id) => {'id': id}).toList();

        const supervisorID = "user_001";

        final visit = {
          'date': _selectedDate!.toIso8601String().split('T')[0],
          'time': _selectedTime!.format(context).toLowerCase().replaceAll(' ', ''),
          'agentID': _selectedAgentId!,
          'location': _location ?? '',
          'reasons': reasons,
          'checklists': checklists,
        };

        print('Submitting visit payload: ${json.encode(visit)}');

        await timesheetProvider.createTimesheet(
          weekNumber: _getWeekNumber(_selectedDate!),
          year: _selectedDate!.year,
          supervisorID: supervisorID,
          visits: [visit],
        );

        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Visit created successfully'), backgroundColor: Theme.of(context).colorScheme.primary),
        );
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create visit: $e'), backgroundColor: Theme.of(context).colorScheme.error),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(80),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Theme.of(context).colorScheme.primary,
                Theme.of(context).colorScheme.secondary,
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
          ),
          child: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            title: Text(
              'Create Visit',
              style: Theme.of(context).appBarTheme.titleTextStyle,
            ),
            centerTitle: true,
            leading: IconButton(
              icon: Icon(Icons.arrow_back_ios_rounded, color: Theme.of(context).appBarTheme.iconTheme!.color, size: 24),
              onPressed: () => Navigator.pop(context),
            ),
          ),
        ),
      ),
      body: Container(
        color: Theme.of(context).scaffoldBackgroundColor,
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Form(
            key: _formKey,
            child: ListView(
              children: [
                _buildSectionCard(
                  title: 'Date & Time',
                  child: Column(
                    children: [
                      _buildTile(
                        icon: Icons.calendar_today,
                        title: _selectedDate == null
                            ? 'Select Date'
                            : '${_selectedDate!.day}/${_selectedDate!.month}/${_selectedDate!.year}',
                        onTap: () => _selectDate(context),
                      ),
                      const SizedBox(height: 12),
                      _buildTile(
                        icon: Icons.access_time,
                        title: _selectedTime == null
                            ? 'Select Time'
                            : _selectedTime!.format(context),
                        onTap: () => _selectTime(context),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _buildSectionCard(
                  title: 'Location & Agent',
                  child: Consumer<AgentProvider>(
                    builder: (context, agentProvider, child) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.surface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.phone, color: Theme.of(context).colorScheme.primary, size: 24),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: TextField(
                                    controller: _phoneController,
                                    keyboardType: TextInputType.phone,
                                    decoration: InputDecoration(
                                      hintText: 'Enter agent\'s phone number',
                                      border: InputBorder.none,
                                      hintStyle: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
                                    ),
                                    style: TextStyle(fontSize: 16, color: Theme.of(context).colorScheme.onSurface),
                                    onChanged: (value) => _onPhoneChanged(value, agentProvider),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (_phoneError != null) ...[
                            const SizedBox(height: 8),
                            Text(
                              _phoneError!,
                              style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12),
                            ),
                          ],
                          const SizedBox(height: 12),
                          GestureDetector(
                            onTap: _agentPhone.isNotEmpty ? null : () => _showLocationDialog(context, agentProvider),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surface,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
                                backgroundBlendMode: _agentPhone.isNotEmpty ? BlendMode.saturation : null,
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.location_on,
                                    color: _agentPhone.isNotEmpty
                                        ? Theme.of(context).colorScheme.onSurface.withOpacity(0.6)
                                        : Theme.of(context).colorScheme.primary,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      _location ?? (_agentPhone.isNotEmpty ? 'Selected via phone' : 'Select Location'),
                                      style: TextStyle(
                                        color: _agentPhone.isNotEmpty
                                            ? Theme.of(context).colorScheme.onSurface.withOpacity(0.6)
                                            : Theme.of(context).colorScheme.onSurface,
                                      ),
                                    ),
                                  ),
                                  Icon(
                                    Icons.arrow_drop_down,
                                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          GestureDetector(
                            onTap: _agentPhone.isNotEmpty || _location == null
                                ? null
                                : () => _showAgentDialog(context, agentProvider),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surface,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
                                backgroundBlendMode: _agentPhone.isNotEmpty || _location == null ? BlendMode.saturation : null,
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.person,
                                    color: _agentPhone.isNotEmpty || _location == null
                                        ? Theme.of(context).colorScheme.onSurface.withOpacity(0.6)
                                        : Theme.of(context).colorScheme.primary,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      _selectedAgentId == null
                                          ? (_agentPhone.isNotEmpty
                                          ? 'Selected via phone'
                                          : _location == null
                                          ? 'Select a location first'
                                          : 'Select Agent')
                                          : '${agentProvider.agents.firstWhere((agent) => agent.agentID == _selectedAgentId).name} ${agentProvider.agents.firstWhere((agent) => agent.agentID == _selectedAgentId).lastname}',
                                      style: TextStyle(
                                        color: _agentPhone.isNotEmpty || _location == null
                                            ? Theme.of(context).colorScheme.onSurface.withOpacity(0.6)
                                            : Theme.of(context).colorScheme.onSurface,
                                      ),
                                    ),
                                  ),
                                  Icon(
                                    Icons.arrow_drop_down,
                                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
                const SizedBox(height: 16),
                _buildSectionCard(
                  title: 'Checklists',
                  child: Consumer<ChecklistProvider>(
                    builder: (context, checklistProvider, child) {
                      return FutureBuilder<List<Checklist>>(
                        future: checklistProvider.getAllChecklists(),
                        builder: (context, snapshot) {
                          if (!snapshot.hasData) {
                            return const Center(child: CircularProgressIndicator());
                          }
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              GestureDetector(
                                onTap: () => _showChecklistDialog(context, checklistProvider),
                                child: Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Theme.of(context).colorScheme.surface,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
                                  ),
                                  child: Row(
                                    children: [
                                      Icon(Icons.checklist, color: Theme.of(context).colorScheme.primary),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Text(
                                          _selectedChecklistIds.isEmpty
                                              ? 'Select Checklists'
                                              : '${_selectedChecklistIds.length} selected',
                                          style: Theme.of(context).textTheme.bodyMedium,
                                        ),
                                      ),
                                      Icon(Icons.arrow_drop_down, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
                                    ],
                                  ),
                                ),
                              ),
                              if (_selectedChecklistIds.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: _selectedChecklistIds.map((id) {
                                    final checklist = snapshot.data!.firstWhere((c) => c.checklistID == id);
                                    return Chip(
                                      label: Text(checklist.item ?? ''),
                                      deleteIcon: const Icon(Icons.close, size: 18),
                                      onDeleted: () {
                                        setState(() {
                                          _selectedChecklistIds.remove(id);
                                        });
                                      },
                                      backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.1),
                                      labelStyle: TextStyle(color: Theme.of(context).colorScheme.primary),
                                    );
                                  }).toList(),
                                ),
                              ],
                            ],
                          );
                        },
                      );
                    },
                  ),
                ),
                const SizedBox(height: 16),
                _buildSectionCard(
                  title: 'Reasons',
                  child: Consumer<ReasonProvider>(
                    builder: (context, reasonProvider, child) {
                      return FutureBuilder<List<Reason>>(
                        future: reasonProvider.getAllReasons(),
                        builder: (context, snapshot) {
                          if (!snapshot.hasData) {
                            return const Center(child: CircularProgressIndicator());
                          }
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              GestureDetector(
                                onTap: () => _showReasonDialog(context, reasonProvider),
                                child: Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Theme.of(context).colorScheme.surface,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
                                  ),
                                  child: Row(
                                    children: [
                                      Icon(Icons.list_alt, color: Theme.of(context).colorScheme.primary),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Text(
                                          _selectedReasonIds.isEmpty
                                              ? 'Select Reasons'
                                              : '${_selectedReasonIds.length} selected',
                                          style: Theme.of(context).textTheme.bodyMedium,
                                        ),
                                      ),
                                      Icon(Icons.arrow_drop_down, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
                                    ],
                                  ),
                                ),
                              ),
                              if (_selectedReasonIds.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: _selectedReasonIds.map((id) {
                                    final reason = snapshot.data!.firstWhere((r) => r.reasonID == id);
                                    return Chip(
                                      label: Text(reason.item ?? ''),
                                      deleteIcon: const Icon(Icons.close, size: 18),
                                      onDeleted: () {
                                        setState(() {
                                          _selectedReasonIds.remove(id);
                                        });
                                      },
                                      backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.1),
                                      labelStyle: TextStyle(color: Theme.of(context).colorScheme.primary),
                                    );
                                  }).toList(),
                                ),
                              ],
                            ],
                          );
                        },
                      );
                    },
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _submitVisit,
                  style: Theme.of(context).elevatedButtonTheme.style,
                  child: Text(
                    'Create Visit',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Theme.of(context).colorScheme.onPrimary),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSectionCard({required String title, required Widget child}) {
    return Card(
      elevation: 2,
      shape: Theme.of(context).cardTheme.shape,
      color: Theme.of(context).cardTheme.color,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }

  Widget _buildTile({required IconData icon, required String title, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
        ),
        child: Row(
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            Icon(Icons.arrow_drop_down, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
          ],
        ),
      ),
    );
  }
}