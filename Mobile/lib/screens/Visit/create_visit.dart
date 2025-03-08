import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:dropdown_search/dropdown_search.dart'; // For searchable dropdowns
import '../../providers/timesheet_provider.dart';
import '../../providers/agent_provider.dart';

class CreateVisitScreen extends StatefulWidget {
  final int weekNumber;
  final int year;

  const CreateVisitScreen({
    required this.weekNumber,
    required this.year,
    super.key,
  });

  @override
  CreateVisitScreenState createState() => CreateVisitScreenState();
}

class CreateVisitScreenState extends State<CreateVisitScreen> {
  final _formKey = GlobalKey<FormState>();
  DateTime? _selectedDate; // Stores the selected date
  TimeOfDay? _selectedTime; // Stores the selected time
  String? _selectedLocation; // Stores the selected location
  String? _selectedAgentID; // Stores the selected agent ID
  bool _isAdding = false;

  @override
  void initState() {
    super.initState();
    // Fetch unique locations when the screen initializes
    final agentProvider = Provider.of<AgentProvider>(context, listen: false);
    agentProvider.fetchUniqueLocations();
  }

  @override
  Widget build(BuildContext context) {
    final timesheetProvider = Provider.of<TimesheetProvider>(context);
    final agentProvider = Provider.of<AgentProvider>(context);

    return Scaffold(
      appBar: PreferredSize(
        preferredSize: Size.fromHeight(80),
        child: Container(
          decoration: BoxDecoration(
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
            title: Text(
              'Create Visit',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            centerTitle: true,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Section Title
              Text(
                'Schedule a New Visit',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFF4CB1C7)),
              ),
              SizedBox(height: 20),

              // Date Picker Card
              _buildInputCard(
                title: 'Select Date',
                icon: Icons.calendar_today,
                child: InkWell(
                  onTap: () async {
                    final pickedDate = await showDatePicker(
                      context: context,
                      initialDate: DateTime.now(),
                      firstDate: DateTime(2000),
                      lastDate: DateTime(2100),
                    );
                    if (pickedDate != null) {
                      setState(() {
                        _selectedDate = pickedDate;
                      });
                    }
                  },
                  child: AnimatedContainer(
                    duration: Duration(milliseconds: 300),
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      border: Border.all(color: Color(0xFF4CB1C7), width: 2),
                      borderRadius: BorderRadius.circular(12),
                      color: _selectedDate == null ? Colors.transparent : Color(0xFFE8F5F9),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          _selectedDate == null
                              ? 'Select a date'
                              : '${_selectedDate!.year}-${_selectedDate!.month.toString().padLeft(2, '0')}-${_selectedDate!.day.toString().padLeft(2, '0')}',
                          style: TextStyle(fontSize: 16, color: Colors.grey[700]),
                        ),
                        Icon(Icons.calendar_today, color: Color(0xFF4CB1C7)),
                      ],
                    ),
                  ),
                ),
              ),

              SizedBox(height: 16),

              // Time Picker Card
              _buildInputCard(
                title: 'Select Time',
                icon: Icons.access_time,
                child: InkWell(
                  onTap: () async {
                    final pickedTime = await showTimePicker(
                      context: context,
                      initialTime: TimeOfDay.now(),
                    );
                    if (pickedTime != null) {
                      setState(() {
                        _selectedTime = pickedTime;
                      });
                    }
                  },
                  child: AnimatedContainer(
                    duration: Duration(milliseconds: 300),
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      border: Border.all(color: Color(0xFF4CB1C7), width: 2),
                      borderRadius: BorderRadius.circular(12),
                      color: _selectedTime == null ? Colors.transparent : Color(0xFFE8F5F9),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          _selectedTime == null
                              ? 'Select a time'
                              : '${_selectedTime!.hour.toString().padLeft(2, '0')}:${_selectedTime!.minute.toString().padLeft(2, '0')}',
                          style: TextStyle(fontSize: 16, color: Colors.grey[700]),
                        ),
                        Icon(Icons.access_time, color: Color(0xFF4CB1C7)),
                      ],
                    ),
                  ),
                ),
              ),

              SizedBox(height: 16),

              // Location Dropdown Card
              _buildInputCard(
                title: 'Select Location',
                icon: Icons.location_on,
                child: DropdownSearch<String>(
                  popupProps: PopupProps.menu(
                    showSelectedItems: true,
                    searchFieldProps: TextFieldProps(
                      decoration: InputDecoration(
                        labelText: 'Search Location',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  items: (String filter, _) {
                    return agentProvider.uniqueLocations
                        .where((location) => location.toLowerCase().contains(filter.toLowerCase()))
                        .toList();
                  },
                  dropdownBuilder: (context, selectedItem) {
                    return AnimatedContainer(
                      duration: Duration(milliseconds: 300),
                      padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        border: Border.all(color: Color(0xFF4CB1C7), width: 2),
                        borderRadius: BorderRadius.circular(12),
                        color: selectedItem == null ? Colors.transparent : Color(0xFFE8F5F9),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            selectedItem ?? 'Select a location',
                            style: TextStyle(fontSize: 16, color: Colors.grey[700]),
                          ),
                          Icon(Icons.location_on, color: Color(0xFF4CB1C7)),
                        ],
                      ),
                    );
                  },
                  onChanged: (String? value) async {
                    setState(() {
                      _selectedLocation = value;
                      _selectedAgentID = null;
                    });
                    if (_selectedLocation != null) {
                      await agentProvider.fetchAgentsByLocation(_selectedLocation!);
                    }
                  },
                  validator: (value) => _selectedLocation == null ? 'Please select a location' : null,
                ),
              ),

              SizedBox(height: 16),

              // Agent Dropdown Card
              _buildInputCard(
                title: 'Select Agent',
                icon: Icons.person,
                child: DropdownSearch<String>(
                  popupProps: PopupProps.menu(
                    showSelectedItems: true,
                    searchFieldProps: TextFieldProps(
                      decoration: InputDecoration(
                        labelText: 'Search Agent',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  items: (String filter, _) {
                    return agentProvider.agents
                        .map((agent) => '${agent.name} ${agent.lastname}')
                        .where((agentName) => agentName.toLowerCase().contains(filter.toLowerCase()))
                        .toList();
                  },
                  dropdownBuilder: (context, selectedItem) {
                    return AnimatedContainer(
                      duration: Duration(milliseconds: 300),
                      padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        border: Border.all(color: Color(0xFF4CB1C7), width: 2),
                        borderRadius: BorderRadius.circular(12),
                        color: selectedItem == null ? Colors.transparent : Color(0xFFE8F5F9),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            selectedItem ?? 'Select an agent',
                            style: TextStyle(fontSize: 16, color: Colors.grey[700]),
                          ),
                          Icon(Icons.person, color: Color(0xFF4CB1C7)),
                        ],
                      ),
                    );
                  },
                  onChanged: (String? value) {
                    if (value != null) {
                      final selectedAgent = agentProvider.agents.firstWhere(
                            (agent) => '${agent.name} ${agent.lastname}' == value,
                      );
                      setState(() {
                        _selectedAgentID = selectedAgent.agentID;
                      });
                    }
                  },
                  validator: (value) => _selectedAgentID == null ? 'Please select an agent' : null,
                ),
              ),

              SizedBox(height: 24),

              // Save Visit Button
              Center(
                child: ElevatedButton.icon(
                  onPressed: () async {
                    if (_formKey.currentState!.validate()) {
                      _formKey.currentState?.save();
                      setState(() {
                        _isAdding = true;
                      });
                      try {
                        // Prepare visit data
                        final visitData = {
                          'date': _selectedDate?.toIso8601String(), // Format date as ISO 8601
                          'time': '${_selectedTime?.hour}:${_selectedTime?.minute}', // Format time as HH:mm
                          'agentID': _selectedAgentID!,
                        };
                        // Add visit to the current timesheet
                        final supervisorID = '1'; // Hardcoded for now
                        await timesheetProvider.createTimesheet(
                          widget.weekNumber,
                          widget.year,
                          supervisorID,
                          [visitData],
                        );
                        if (mounted) {
                          Navigator.pop(context);
                        }
                      } catch (e) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Failed to create timesheet: $e')),
                        );
                      } finally {
                        setState(() {
                          _isAdding = false;
                        });
                      }
                    }
                  },
                  icon: _isAdding ? CircularProgressIndicator(color: Colors.white) : Icon(color: Color(0xFFFFFFFF),Icons.save),
                  label: Text(
                    style: TextStyle(color: Colors.white),
                      _isAdding ? 'Saving...' : 'Save Visit'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Color(0xFF4CB1C7),
                    padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInputCard({required String title, required IconData icon, required Widget child}) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: Color(0xFF4CB1C7), size: 20),
                SizedBox(width: 8),
                Text(
                  title,
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF4CB1C7)),
                ),
              ],
            ),
            SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}