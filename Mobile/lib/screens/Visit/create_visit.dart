import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:visit_management/models/checklist.dart';
import 'package:visit_management/models/reason.dart';
import 'package:visit_management/models/agent.dart'; // Import the real Agent model
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
  final TextEditingController _customChecklistController = TextEditingController();
  final TextEditingController _customReasonController = TextEditingController();
  String? _location;

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
    _customChecklistController.dispose();
    _customReasonController.dispose();
    super.dispose();
  }

  Future<void> _selectDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now(),
      firstDate: DateTime(widget.year),
      lastDate: DateTime(widget.year + 1),
      builder: (context, child) {
        return Theme(
          data: ThemeData.light().copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF4CB1C7),
              onPrimary: Colors.white,
              surface: Colors.white,
              onSurface: Colors.black87,
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
          data: ThemeData.light().copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF4CB1C7),
              onPrimary: Colors.white,
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
              title: const Text('Select Location'),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: searchController,
                      decoration: InputDecoration(
                        hintText: 'Search locations...',
                        prefixIcon: const Icon(Icons.search, color: Color(0xFF4CB1C7)),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onChanged: (value) {
                        setDialogState(() {
                          filteredLocations = locations
                              .where((location) => location
                              .toLowerCase()
                              .contains(value.toLowerCase()))
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
                                _selectedAgentId = null; // Reset agent when location changes
                              });
                              agentProvider.fetchAgentsByLocation(value!);
                              Navigator.pop(context);
                            },
                            activeColor: const Color(0xFF4CB1C7),
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
                  child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _showAgentDialog(BuildContext context, AgentProvider agentProvider) async {
    final agents = agentProvider.agents; // This should now be List<Agent> from models/agent.dart
    final TextEditingController searchController = TextEditingController();
    List<Agent> filteredAgents = List.from(agents);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Select Agent'),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: searchController,
                      decoration: InputDecoration(
                        hintText: 'Search agents...',
                        prefixIcon: const Icon(Icons.search, color: Color(0xFF4CB1C7)),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onChanged: (value) {
                        setDialogState(() {
                          filteredAgents = agents
                              .where((agent) =>
                          '${agent.name} ${agent.lastname}'
                              .toLowerCase()
                              .contains(value.toLowerCase()) ||
                              agent.agentID!
                                  .toLowerCase()
                                  .contains(value.toLowerCase()))
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
                            activeColor: const Color(0xFF4CB1C7),
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
                  child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
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
              title: const Text('Select Checklists'),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: searchController,
                      decoration: InputDecoration(
                        hintText: 'Search checklists...',
                        prefixIcon: const Icon(Icons.search, color: Color(0xFF4CB1C7)),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onChanged: (value) {
                        setDialogState(() {
                          filteredChecklists = allChecklists
                              .where((checklist) => (checklist.item ?? '')
                              .toLowerCase()
                              .contains(value.toLowerCase()))
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
                            activeColor: const Color(0xFF4CB1C7),
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
                  child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
                ),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _selectedChecklistIds = selectedIds;
                    });
                    Navigator.pop(context);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4CB1C7),
                  ),
                  child: const Text('Confirm', style: TextStyle(color: Colors.white)),
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
              title: const Text('Select Reasons'),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: searchController,
                      decoration: InputDecoration(
                        hintText: 'Search reasons...',
                        prefixIcon: const Icon(Icons.search, color: Color(0xFF4CB1C7)),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onChanged: (value) {
                        setDialogState(() {
                          filteredReasons = allReasons
                              .where((reason) => (reason.item ?? '')
                              .toLowerCase()
                              .contains(value.toLowerCase()))
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
                            activeColor: const Color(0xFF4CB1C7),
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
                  child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
                ),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _selectedReasonIds = selectedIds;
                    });
                    Navigator.pop(context);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4CB1C7),
                  ),
                  child: const Text('Confirm', style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _submitVisit() async {
    if (_formKey.currentState!.validate()) {
      if (_selectedDate == null || _selectedTime == null || _selectedAgentId == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please fill all required fields')),
        );
        return;
      }

      final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);

      try {
        List<Map<String, String>> checklists = _selectedChecklistIds.map((id) => {'id': id}).toList();
        if (_customChecklistController.text.isNotEmpty) {
          checklists.add({'text': _customChecklistController.text});
        }

        List<Map<String, String>> reasons = _selectedReasonIds.map((id) => {'id': id}).toList();
        if (_customReasonController.text.isNotEmpty) {
          reasons.add({'text': _customReasonController.text});
        }

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
          weekNumber: widget.weekNumber,
          year: widget.year,
          supervisorID: supervisorID,
          visits: [visit],
        );

        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Visit created successfully')),
        );
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create visit: $e')),
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
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF4CB1C7), Color(0xFF64C9D1)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
          ),
          child: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            title: const Text(
              'Create Visit',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            centerTitle: true,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_rounded, color: Colors.white, size: 24),
              onPressed: () => Navigator.pop(context),
            ),
          ),
        ),
      ),
      body: Container(
        color: Colors.grey[100],
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
                  child: Column(
                    children: [
                      Consumer<AgentProvider>(
                        builder: (context, agentProvider, child) {
                          return GestureDetector(
                            onTap: () => _showLocationDialog(context, agentProvider),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Colors.grey[300]!),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.location_on, color: Color(0xFF4CB1C7)),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      _location ?? 'Select Location',
                                      style: const TextStyle(color: Colors.black87),
                                    ),
                                  ),
                                  const Icon(Icons.arrow_drop_down, color: Colors.grey),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 12),
                      Consumer<AgentProvider>(
                        builder: (context, agentProvider, child) {
                          return GestureDetector(
                            onTap: _location == null
                                ? null
                                : () => _showAgentDialog(context, agentProvider),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: _location == null ? Colors.grey[300]! : Colors.grey[300]!,
                                ),
                                backgroundBlendMode:
                                _location == null ? BlendMode.saturation : null,
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.person,
                                    color: _location == null
                                        ? Colors.grey
                                        : const Color(0xFF4CB1C7),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      _selectedAgentId == null
                                          ? (_location == null
                                          ? 'Select a location first'
                                          : 'Select Agent')
                                          : '${agentProvider.agents.firstWhere((agent) => agent.agentID == _selectedAgentId).name} ${agentProvider.agents.firstWhere((agent) => agent.agentID == _selectedAgentId).lastname}',
                                      style: TextStyle(
                                        color:
                                        _location == null ? Colors.grey : Colors.black87,
                                      ),
                                    ),
                                  ),
                                  Icon(
                                    Icons.arrow_drop_down,
                                    color: _location == null ? Colors.grey : Colors.grey,
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _buildSectionCard(
                  title: 'Checklists',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Consumer<ChecklistProvider>(
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
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: Colors.grey[300]!),
                                      ),
                                      child: Row(
                                        children: [
                                          const Icon(Icons.checklist, color: Color(0xFF4CB1C7)),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Text(
                                              _selectedChecklistIds.isEmpty
                                                  ? 'Select Checklists'
                                                  : '${_selectedChecklistIds.length} selected',
                                              style: const TextStyle(color: Colors.black87),
                                            ),
                                          ),
                                          const Icon(Icons.arrow_drop_down, color: Colors.grey),
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
                                        final checklist = snapshot.data!
                                            .firstWhere((c) => c.checklistID == id);
                                        return Chip(
                                          label: Text(checklist.item ?? ''),
                                          deleteIcon: const Icon(Icons.close, size: 18),
                                          onDeleted: () {
                                            setState(() {
                                              _selectedChecklistIds.remove(id);
                                            });
                                          },
                                          backgroundColor: const Color(0xFF4CB1C7).withOpacity(0.1),
                                          labelStyle: const TextStyle(color: Color(0xFF4CB1C7)),
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
                      const SizedBox(height: 12),
                      _buildTextField(
                        controller: _customChecklistController,
                        label: 'Add Custom Checklist',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _buildSectionCard(
                  title: 'Reasons',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Consumer<ReasonProvider>(
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
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: Colors.grey[300]!),
                                      ),
                                      child: Row(
                                        children: [
                                          const Icon(Icons.list_alt, color: Color(0xFF4CB1C7)),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Text(
                                              _selectedReasonIds.isEmpty
                                                  ? 'Select Reasons'
                                                  : '${_selectedReasonIds.length} selected',
                                              style: const TextStyle(color: Colors.black87),
                                            ),
                                          ),
                                          const Icon(Icons.arrow_drop_down, color: Colors.grey),
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
                                        final reason = snapshot.data!
                                            .firstWhere((r) => r.reasonID == id);
                                        return Chip(
                                          label: Text(reason.item ?? ''),
                                          deleteIcon: const Icon(Icons.close, size: 18),
                                          onDeleted: () {
                                            setState(() {
                                              _selectedReasonIds.remove(id);
                                            });
                                          },
                                          backgroundColor: const Color(0xFF4CB1C7).withOpacity(0.1),
                                          labelStyle: const TextStyle(color: Color(0xFF4CB1C7)),
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
                      const SizedBox(height: 12),
                      _buildTextField(
                        controller: _customReasonController,
                        label: 'Add Custom Reason',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _submitVisit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4CB1C7),
                    padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 32),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 4,
                  ),
                  child: const Text(
                    'Create Visit',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
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
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: Color(0xFF4CB1C7),
              ),
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
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey[300]!),
        ),
        child: Row(
          children: [
            Icon(icon, color: const Color(0xFF4CB1C7), size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(fontSize: 16, color: Colors.black87),
              ),
            ),
            const Icon(Icons.arrow_drop_down, color: Colors.grey),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField({required TextEditingController controller, required String label}) {
    return TextFormField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Color(0xFF4CB1C7)),
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.grey[300]!),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.grey[300]!),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF4CB1C7)),
        ),
      ),
    );
  }
}