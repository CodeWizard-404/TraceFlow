import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import '../../models/visit.dart';
import '../../providers/timesheet_provider.dart';
import '../../providers/auth_provider.dart';
import '../Visit/visit_item.dart';
import '../../services/agent_service.dart';
import '../../services/location_service.dart';
import '../../models/agent.dart';
import '../../models/delegation.dart';
import '../../models/region.dart';
import '../../models/governorate.dart';
import 'package:intl/intl.dart';

class TimesheetSuggestionsModal extends StatefulWidget {
  final int weekNumber;
  final int year;
  final String supervisorID;
  final GlobalKey<ScaffoldMessengerState> scaffoldMessengerKey;

  const TimesheetSuggestionsModal({
    super.key,
    required this.weekNumber,
    required this.year,
    required this.supervisorID,
    required this.scaffoldMessengerKey,
  });

  @override
  TimesheetSuggestionsModalState createState() => TimesheetSuggestionsModalState();

  static Future<void> show({
    required BuildContext context,
    required int weekNumber,
    required int year,
    required String supervisorID,
    required GlobalKey<ScaffoldMessengerState> scaffoldMessengerKey,
  }) async {
    await showDialog(
      context: context,
      builder: (context) => TimesheetSuggestionsModal(
        weekNumber: weekNumber,
        year: year,
        supervisorID: supervisorID,
        scaffoldMessengerKey: scaffoldMessengerKey,
      ),
    );
  }
}

class TimesheetSuggestionsModalState extends State<TimesheetSuggestionsModal> {
  final _formKey = GlobalKey<FormState>();
  bool _showSuggestions = false;
  bool _isLoading = false;
  bool _includeRecruitmentVisits = false;
  String? _locationError;
  Position? _userLocation;

// Form data
  String _startTime = '08:00';
  String _endTime = '17:00';
  int _maxVisitsPerAgentPerWeek = 2;
  String _description = '';
  List<String> _delegationIds = [];
  List<String> _agentIds = [];
  List<String> _preferredDays = [];
  String? _selectedRegion;
  String? _selectedGovernorate;
  String? _selectedRecruitmentDelegation;

// Data for dropdowns
  List<Agent> _agents = [];
  List<Delegation> _delegations = [];
  List<Region> _regions = [];
  List<Governorate> _governorates = [];
  List<Delegation> _recruitmentDelegations = [];

// Loading states
  bool _isAgentsLoading = false;
  bool _isDelegationsLoading = false;
  bool _isRegionsLoading = false;
  bool _isGovernoratesLoading = false;
  bool _isRecruitmentDelegationsLoading = false;

  @override
  void initState() {
    super.initState();
    _startTime = '08:00';
    _endTime = '17:00';
    _fetchUserLocation();
// Pre-fetch agents and delegations to ensure they're available
    _fetchAgents();
    _fetchDelegations();
  }

  Future<void> _fetchUserLocation() async {
    if (kDebugMode) print('Fetching user location');
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() => _locationError = 'Location services are disabled. Proceeding without location.');
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          setState(() => _locationError = 'Location permissions are denied. Proceeding without location.');
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        setState(() => _locationError = 'Location permissions are permanently denied. Proceeding without location.');
        return;
      }

      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
      setState(() {
        _userLocation = position;
        _locationError = null;
      });
      if (kDebugMode) print('Location fetched: lat=${position.latitude}, lng=${position.longitude}');
    } catch (e) {
      setState(() => _locationError = 'Failed to get location: $e. Proceeding without location.');
      if (kDebugMode) print('Location error: $e');
    }
  }

  Future<void> _fetchAgents() async {
    if (_isAgentsLoading || _agents.isNotEmpty) return;
    if (kDebugMode) print('Fetching agents for supervisor: ${widget.supervisorID}');
    setState(() => _isAgentsLoading = true);
    try {
      final agents = await AgentService.getAgentsByUser(widget.supervisorID);
      setState(() {
        _agents = agents;
      });
      if (_agents.isEmpty) {
        if (kDebugMode) print('No agents found');
        widget.scaffoldMessengerKey.currentState?.showSnackBar(
          const SnackBar(content: Text('No agents available')),
        );
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching agents: $e');
      widget.scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(content: Text('Failed to fetch agents: $e')),
      );
    } finally {
      setState(() => _isAgentsLoading = false);
    }
  }


  Future<void> _fetchDelegations() async {
    if (_isDelegationsLoading || _delegations.isNotEmpty) return;
    if (kDebugMode) print('Fetching delegations for supervisor: ${widget.supervisorID}');
    setState(() => _isDelegationsLoading = true);
    try {
      final delegationsData = await LocationService.getDelegationsByUser(widget.supervisorID);
      if (kDebugMode) print('Delegations data received: $delegationsData');
      setState(() {
        _delegations = (delegationsData as List<dynamic>)
            .map((data) => Delegation.fromJson(data as Map<String, dynamic>))
            .toList();
      });
      if (_delegations.isEmpty) {
        if (kDebugMode) print('No delegations found');
        widget.scaffoldMessengerKey.currentState?.showSnackBar(
          const SnackBar(content: Text('No delegations available')),
        );
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching delegations: $e');
      widget.scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(content: Text('Failed to fetch delegations: $e')),
      );
    } finally {
      setState(() => _isDelegationsLoading = false);
    }
  }

  Future<void> _fetchRegions() async {
    if (_isRegionsLoading || _regions.isNotEmpty) return;
    if (kDebugMode) print('Fetching regions for supervisor: ${widget.supervisorID}');
    setState(() => _isRegionsLoading = true);
    try {
      final regionsData = await LocationService.getRegionsByUser(widget.supervisorID);
      setState(() {
        _regions = (regionsData as List<dynamic>)
            .map((data) => Region.fromJson(data as Map<String, dynamic>))
            .toList();
        if (_regions.length == 1) {
          _selectedRegion = _regions[0].regionID;
          _fetchGovernorates(_regions[0].regionID);
        }
      });
    } catch (e) {
      if (kDebugMode) print('Error fetching regions: $e');
      widget.scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(content: Text('Failed to fetch regions: $e')),
      );
    } finally {
      setState(() => _isRegionsLoading = false);
    }
  }

  Future<void> _fetchGovernorates(String regionID) async {
    if (_isGovernoratesLoading || _governorates.any((g) => g.regionID == regionID)) return;
    if (kDebugMode) print('Fetching governorates for region: $regionID');
    setState(() => _isGovernoratesLoading = true);
    try {
      final governoratesData = await LocationService.getGovernoratesByRegion(regionID);
      setState(() {
        _governorates = (governoratesData as List<dynamic>)
            .map((data) => Governorate.fromJson(data as Map<String, dynamic>))
            .toList();
        if (_governorates.length == 1) {
          _selectedGovernorate = _governorates[0].governorateID;
          _fetchRecruitmentDelegations(_governorates[0].governorateID);
        }
      });
    } catch (e) {
      if (kDebugMode) print('Error fetching governorates: $e');
      widget.scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(content: Text('Failed to fetch governorates: $e')),
      );
    } finally {
      setState(() => _isGovernoratesLoading = false);
    }
  }

  Future<void> _fetchRecruitmentDelegations(String governorateId) async {
    if (_isRecruitmentDelegationsLoading || _recruitmentDelegations.any((d) => d.governorateID == governorateId)) return;
    if (kDebugMode) print('Fetching recruitment delegations for governorate: $governorateId');
    setState(() => _isRecruitmentDelegationsLoading = true);
    try {
      final delegationsData = await LocationService.getDelegationsByGovernorate(governorateId);
      setState(() {
        _recruitmentDelegations = (delegationsData as List<dynamic>)
            .map((data) => Delegation.fromJson(data as Map<String, dynamic>))
            .toList();
        if (_recruitmentDelegations.length == 1) {
          _selectedRecruitmentDelegation = _recruitmentDelegations[0].delegationID;
        }
      });
    } catch (e) {
      if (kDebugMode) print('Error fetching recruitment delegations: $e');
      widget.scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(content: Text('Failed to fetch recruitment delegations: $e')),
      );
    } finally {
      setState(() => _isRecruitmentDelegationsLoading = false);
    }
  }

  List<String> _getWeekDates() {
    final jan1 = DateTime(widget.year, 1, 1);
    final firstMonday = jan1.weekday <= 4
        ? jan1.subtract(Duration(days: jan1.weekday - 1))
        : jan1.add(Duration(days: 8 - jan1.weekday));
    final weekStart = firstMonday.add(Duration(days: (widget.weekNumber - 1) * 7));
    return List.generate(7, (i) {
      final date = weekStart.add(Duration(days: i));
      return DateFormat('yyyy-MM-dd').format(date);
    });
  }

  Widget _buildMultiSelectField({
    required String label,
    required List<String> items,
    required List<String> selectedItems,
    required String Function(String) formatter,
    required VoidCallback onTap,
    bool isLoading = false,
  }) {
    if (kDebugMode) print('Building $label field with ${items.length} items');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 8),
        isLoading
            ? const Center(child: CircularProgressIndicator())
            : items.isEmpty
            ? Text(
          'No $label available',
          style: TextStyle(color: Theme.of(context).colorScheme.error),
        )
            : Wrap(
          spacing: 8,
          children: items.map((item) {
            final isSelected = selectedItems.contains(item);
            return ChoiceChip(
              label: Text(formatter(item)),
              selected: isSelected,
              onSelected: (selected) {
                if (kDebugMode) print('Selected $label: $item, selected: $selected');
                onTap();
                setState(() {
                  if (selected) {
                    selectedItems.add(item);
                  } else {
                    selectedItems.remove(item);
                  }
                });
              },
            );
          }).toList(),
        ),
        const SizedBox(height: 8),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final timesheetProvider = Provider.of<TimesheetProvider>(context);
    final weekDates = _getWeekDates();

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 400, maxHeight: 600),
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Timesheet Suggestions',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.primary,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () {
                    final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);
                    if (timesheetProvider.suggestedVisits.isNotEmpty) {
                      showDialog(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('Unsaved Suggestions'),
                          content: const Text('You have unsaved suggestions. Do you want to save them?'),
                          actions: [
                            TextButton(
                              onPressed: () {
                                Navigator.pop(context); // Close dialog
                                timesheetProvider.clearSuggestedVisits();
                                Navigator.pop(context); // Close modal
                              },
                              child: const Text('Discard'),
                            ),
                            TextButton(
                              onPressed: () async {
                                await timesheetProvider.saveSuggestedVisits(widget.supervisorID);
                                Navigator.pop(context); // Close dialog
                                Navigator.pop(context); // Close modal
                              },
                              child: const Text('Save'),
                            ),
                          ],
                        ),
                      );
                    } else {
                      timesheetProvider.clearSuggestedVisits();
                      Navigator.pop(context);
                    }
                  },
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_locationError != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  _locationError!,
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ),
            if (!_showSuggestions) ...[
              Expanded(
                child: Form(
                  key: _formKey,
                  child: ListView(
                    children: [
// Preferred Days
                      _buildMultiSelectField(
                        label: 'Preferred Days',
                        items: weekDates,
                        selectedItems: _preferredDays,
                        formatter: (date) => DateFormat('EEE, d MMM').format(DateTime.parse(date)),
                        onTap: () {
                          if (kDebugMode) print('Preferred days tapped');
                        },
                        isLoading: false,
                      ),
                      const Divider(height: 16),
// Delegations
                      _buildMultiSelectField(
                        label: 'Delegations',
                        items: _delegations.map((d) => d.delegationID).toList(),
                        selectedItems: _delegationIds,
                        formatter: (id) => _delegations.firstWhere((d) => d.delegationID == id).name,
                        onTap: _fetchDelegations,
                        isLoading: _isDelegationsLoading,
                      ),
// Agents
                      _buildMultiSelectField(
                        label: 'Agents',
                        items: _agents.map((a) => a.agentID).toList(),
                        selectedItems: _agentIds,
                        formatter: (id) {
                          final agent = _agents.firstWhere((a) => a.agentID == id);
                          return '${agent.name} ${agent.lastname}';
                        },
                        onTap: _fetchAgents,
                        isLoading: _isAgentsLoading,
                      ),
                      const Divider(height: 16),
// Include Recruitment Visits
                      SwitchListTile(
                        title: const Text('Include Recruitment Visits'),
                        value: _includeRecruitmentVisits,
                        onChanged: (value) {
                          setState(() {
                            _includeRecruitmentVisits = value;
                            if (!value) {
                              _selectedRegion = null;
                              _selectedGovernorate = null;
                              _selectedRecruitmentDelegation = null;
                            } else {
                              _fetchRegions();
                            }
                          });
                        },
                      ),
// Recruitment Areas
                      if (_includeRecruitmentVisits) ...[
                        _isRegionsLoading
                            ? const Center(child: CircularProgressIndicator())
                            : DropdownButtonFormField<String>(
                          decoration: const InputDecoration(
                            labelText: 'Region',
                            border: OutlineInputBorder(),
                          ),
                          isExpanded: true,
                          items: _regions.map((region) {
                            return DropdownMenuItem<String>(
                              value: region.regionID,
                              child: Text(region.name),
                            );
                          }).toList(),
                          value: _selectedRegion,
                          onChanged: (value) {
                            setState(() {
                              _selectedRegion = value;
                              _selectedGovernorate = null;
                              _selectedRecruitmentDelegation = null;
                              if (value != null) {
                                _fetchGovernorates(value);
                              }
                            });
                          },
                          hint: const Text('Select Region'),
                        ),
                        const SizedBox(height: 8),
                        _isGovernoratesLoading
                            ? const Center(child: CircularProgressIndicator())
                            : DropdownButtonFormField<String>(
                          decoration: const InputDecoration(
                            labelText: 'Governorate',
                            border: OutlineInputBorder(),
                          ),
                          isExpanded: true,
                          items: _governorates.map((governorate) {
                            return DropdownMenuItem<String>(
                              value: governorate.governorateID,
                              child: Text(governorate.name),
                            );
                          }).toList(),
                          value: _selectedGovernorate,
                          onChanged: (value) {
                            setState(() {
                              _selectedGovernorate = value;
                              _selectedRecruitmentDelegation = null;
                              if (value != null) {
                                _fetchRecruitmentDelegations(value);
                              }
                            });
                          },
                          hint: const Text('Select Governorate'),
                          disabledHint: const Text('Select a Region first'),
                          validator: (value) =>
                          _selectedRegion != null && value == null ? 'Please select a Governorate' : null,
                        ),
                        const SizedBox(height: 8),
                        _isRecruitmentDelegationsLoading
                            ? const Center(child: CircularProgressIndicator())
                            : DropdownButtonFormField<String>(
                          decoration: const InputDecoration(
                            labelText: 'Recruitment Delegation',
                            border: OutlineInputBorder(),
                          ),
                          isExpanded: true,
                          items: _recruitmentDelegations.map((delegation) {
                            return DropdownMenuItem<String>(
                              value: delegation.delegationID,
                              child: Text(delegation.name),
                            );
                          }).toList(),
                          value: _selectedRecruitmentDelegation,
                          onChanged: (value) {
                            setState(() => _selectedRecruitmentDelegation = value);
                          },
                          hint: const Text('Select Delegation'),
                          disabledHint: const Text('Select a Governorate first'),
                          validator: (value) => _selectedGovernorate != null && value == null
                              ? 'Please select a Delegation'
                              : null,
                        ),
                      ],
                      const Divider(height: 16),
// Time Interval
                      Row(
                        children: [
                          Expanded(
                            child: GestureDetector(
                              onTap: () async {
                                if (kDebugMode) print('Start time tapped');
                                final time = await showTimePicker(
                                  context: context,
                                  initialTime: TimeOfDay(
                                    hour: int.tryParse(_startTime.split(':')[0]) ?? 8,
                                    minute: int.tryParse(_startTime.split(':')[1]) ?? 0,
                                  ),
                                );
                                if (time != null) {
                                  setState(() {
                                    _startTime = '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
                                    if (kDebugMode) print('Start time set to: $_startTime');
                                  });
                                }
                              },
                              child: AbsorbPointer(
                                child: TextFormField(
                                  decoration: const InputDecoration(
                                    labelText: 'Start Time (HH:mm)',
                                    border: OutlineInputBorder(),
                                  ),
                                  controller: TextEditingController(text: _startTime),
                                  validator: (value) {
                                    if (value == null || !RegExp(r'^(?:[01]\d|2[0-3]):[0-5]\d$').hasMatch(value)) {
                                      return 'Invalid time (HH:mm, 00:00-23:59)';
                                    }
                                    return null;
                                  },
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: GestureDetector(
                              onTap: () async {
                                if (kDebugMode) print('End time tapped');
                                final time = await showTimePicker(
                                  context: context,
                                  initialTime: TimeOfDay(
                                    hour: int.tryParse(_endTime.split(':')[0]) ?? 17,
                                    minute: int.tryParse(_endTime.split(':')[1]) ?? 0,
                                  ),
                                );
                                if (time != null) {
                                  setState(() {
                                    _endTime = '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
                                    if (kDebugMode) print('End time set to: $_endTime');
                                  });
                                }
                              },
                              child: AbsorbPointer(
                                child: TextFormField(
                                  decoration: const InputDecoration(
                                    labelText: 'End Time (HH:mm)',
                                    border: OutlineInputBorder(),
                                  ),
                                  controller: TextEditingController(text: _endTime),
                                  validator: (value) {
                                    if (value == null || !RegExp(r'^(?:[01]\d|2[0-3]):[0-5]\d$').hasMatch(value)) {
                                      return 'Invalid time (HH:mm, 00:00-23:59)';
                                    }
                                    try {
                                      final start = DateTime.parse('2000-01-01 $_startTime:00');
                                      final end = DateTime.parse('2000-01-01 $value:00');
                                      if (end.isBefore(start) || end.isAtSameMomentAs(start)) {
                                        return 'End time must be after start';
                                      }
                                    } catch (e) {
                                      return 'Invalid time format';
                                    }
                                    return null;
                                  },
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
// Max Visits Per Agent
                      TextFormField(
                        initialValue: _maxVisitsPerAgentPerWeek.toString(),
                        decoration: const InputDecoration(
                          labelText: 'Max Visits Per Agent Per Week',
                          border: OutlineInputBorder(),
                        ),
                        keyboardType: TextInputType.number,
                        validator: (value) {
                          final num = int.tryParse(value ?? '');
                          if (num == null || num < 1) {
                            return 'Enter a valid number (≥1)';
                          }
                          return null;
                        },
                        onSaved: (value) => _maxVisitsPerAgentPerWeek = int.parse(value!),
                      ),
                      const Divider(height: 16),
// Description
                      TextFormField(
                        initialValue: _description,
                        decoration: const InputDecoration(
                          labelText: 'Description',
                          border: OutlineInputBorder(),
                        ),
                        maxLines: 3,
                        onSaved: (value) => _description = value ?? '',
                      ),
                      const SizedBox(height: 16),
                      _isLoading
                          ? const Center(child: CircularProgressIndicator())
                          : ElevatedButton(
                        onPressed: () async {
                          if (kDebugMode) print('Generate button pressed');
                          if (!_formKey.currentState!.validate()) {
                            if (kDebugMode) print('Form validation failed');
                            widget.scaffoldMessengerKey.currentState?.showSnackBar(
                              const SnackBar(content: Text('Please correct the form errors')),
                            );
                            return;
                          }
                          if (kDebugMode) print('Form validated, saving form');
                          _formKey.currentState!.save();
                          setState(() => _isLoading = true);
                          final timesheetProvider =
                          Provider.of<TimesheetProvider>(context, listen: false);
                          try {
                            if (kDebugMode) print('Parsing startHour and endHour');
                            final startHour = int.tryParse(_startTime.split(':')[0]) ?? 8;
                            final endHour = int.tryParse(_endTime.split(':')[0]) ?? 17;
                            if (kDebugMode) print('Building criteria');
                            final recruitmentAreas = _includeRecruitmentVisits
                                ? [
                              if (_selectedRegion != null)
                                _regions
                                    .firstWhere((r) => r.regionID == _selectedRegion)
                                    .name,
                              if (_selectedGovernorate != null)
                                _governorates
                                    .firstWhere(
                                        (g) => g.governorateID == _selectedGovernorate)
                                    .name,
                              if (_selectedRecruitmentDelegation != null)
                                _recruitmentDelegations
                                    .firstWhere((d) =>
                                d.delegationID == _selectedRecruitmentDelegation)
                                    .name,
                            ].where((name) => name.isNotEmpty).toList()
                                : [];
                            final criteria = {
                              'delegationIds': _delegationIds,
                              'agentIds': _agentIds,
                              'preferredDays': _preferredDays,
                              'timeInterval': {
                                'startHour': startHour,
                                'endHour': endHour,
                              },
                              'maxVisitsPerAgentPerWeek': _maxVisitsPerAgentPerWeek,
                              'includeRecruitmentVisits': _includeRecruitmentVisits,
                              'recruitmentAreas': recruitmentAreas,
                              'description': _description,
                              'filters': {},
                            };
                            final Map<String, dynamic> coordinates = _userLocation != null
                                ? {
                              'lat': _userLocation!.latitude,
                              'lng': _userLocation!.longitude,
                            }
                                : {};
                            if (kDebugMode) {
                              print('Calling suggestTimesheet with:');
                              print('SupervisorID: ${widget.supervisorID}');
                              print('WeekNumber: ${widget.weekNumber}');
                              print('Year: ${widget.year}');
                              print('Coordinates: $coordinates');
                              print('Criteria: $criteria');
                            }
                            final result = await timesheetProvider.suggestTimesheet(
                              supervisorID: widget.supervisorID,
                              weekNumber: widget.weekNumber,
                              year: widget.year,
                              coordinates: coordinates,
                              criteria: criteria,
                            );
                            if (kDebugMode) print('Received result: $result');
                            final suggestedVisits = (result['suggestions'] as List)
                                .map((v) => Visit.fromJson(v as Map<String, dynamic>))
                                .toList();
                            if (kDebugMode) print('Parsed ${suggestedVisits.length} suggested visits');
                            timesheetProvider.setSuggestedVisits(suggestedVisits);
                            setState(() {
                              _showSuggestions = true;
                              _isLoading = false;
                            });
                            if (kDebugMode) print('Suggestions displayed');
                          } catch (e) {
                            if (kDebugMode) print('Error in suggestTimesheet: $e');
                            setState(() => _isLoading = false);
                            widget.scaffoldMessengerKey.currentState?.showSnackBar(
                              SnackBar(content: Text('Failed to generate suggestions: $e')),
                            );
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: theme.colorScheme.primary,
                          foregroundColor: theme.colorScheme.onPrimary,
                        ),
                        child: const Text('Generate Suggestions'),
                      ),
                    ],
                  ),
                ),
              ),
            ] else if (timesheetProvider.isLoading)
              const Center(child: CircularProgressIndicator())
            else if (timesheetProvider.suggestedVisits.isEmpty)
                const Text('No suggestions available')
              else
                Expanded(
                  child: Column(
                    children: [
                      Expanded(
                        child: DragTarget<Visit>(
                          onWillAccept: (data) => true,
                          onAcceptWithDetails: (details) {
                            final droppedVisit = details.data;
                            final currentVisits = List<Visit>.from(timesheetProvider.suggestedVisits);
                            final newIndex = currentVisits.indexWhere((v) => v.visitID == droppedVisit.visitID);
                            currentVisits.removeWhere((v) => v.visitID == droppedVisit.visitID);
                            currentVisits.insert(newIndex >= 0 ? newIndex : currentVisits.length, droppedVisit);
                            timesheetProvider.setSuggestedVisits(currentVisits);
                          },
                          builder: (context, candidateData, rejectedData) {
                            return ListView.builder(
                              shrinkWrap: true,
                              itemCount: timesheetProvider.suggestedVisits.length,
                              itemBuilder: (context, index) {
                                final visit = timesheetProvider.suggestedVisits[index];
                                return LongPressDraggable<Visit>(
                                  data: visit,
                                  feedback: Material(
                                    elevation: 4,
                                    borderRadius: BorderRadius.circular(8),
                                    child: Opacity(
                                      opacity: 0.8,
                                      child: VisitItem(
                                        visit: visit,
                                        isSuggested: true,
                                        isDraggable: false,
                                        onToggleSelection: (visitID) {
                                          timesheetProvider.toggleSuggestedVisitSelection(visitID);
                                        },
                                      ),
                                    ),
                                  ),
                                  childWhenDragging: Opacity(
                                    opacity: 0.3,
                                    child: VisitItem(
                                      visit: visit,
                                      isSuggested: true,
                                      isDraggable: false,
                                      onToggleSelection: (visitID) {
                                        timesheetProvider.toggleSuggestedVisitSelection(visitID);
                                      },
                                    ),
                                  ),
                                  child: VisitItem(
                                    visit: visit,
                                    isSuggested: true,
                                    isDraggable: true,
                                    onToggleSelection: (visitID) {
                                      timesheetProvider.toggleSuggestedVisitSelection(visitID);
                                    },
                                  ),
                                );
                              },
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (timesheetProvider.suggestedVisits.isNotEmpty)
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            TextButton(
                              onPressed: () {
                                timesheetProvider.selectAllSuggestedVisits();
                              },
                              child: Text(
                                'Select All',
                                style: TextStyle(color: theme.colorScheme.primary),
                              ),
                            ),
                            TextButton(
                              onPressed: () {
                                timesheetProvider.clearSuggestedVisits();
                                Navigator.pop(context);
                              },
                              child: Text(
                                'Cancel',
                                style: TextStyle(color: theme.colorScheme.error),
                              ),
                            ),
                            ElevatedButton(
                              onPressed: () async {
                                try {
                                  await timesheetProvider.saveSuggestedVisits(widget.supervisorID);
                                  Navigator.pop(context);
                                  widget.scaffoldMessengerKey.currentState?.showSnackBar(
                                    const SnackBar(content: Text('Suggestions saved successfully')),
                                  );
                                } catch (e) {
                                  widget.scaffoldMessengerKey.currentState?.showSnackBar(
                                    SnackBar(content: Text('Failed to save suggestions: $e')),
                                  );
                                }
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: theme.colorScheme.primary,
                                foregroundColor: theme.colorScheme.onPrimary,
                              ),
                              child: const Text('Save'),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
          ],
        ),
      ),
    );
  }
}
