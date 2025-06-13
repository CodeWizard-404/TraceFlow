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
    _fetchUserLocation();
  }

  Future<void> _fetchUserLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() => _locationError = 'Location services are disabled.');
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          setState(() => _locationError = 'Location permissions are denied.');
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        setState(() => _locationError = 'Location permissions are permanently denied.');
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
    } catch (e) {
      setState(() => _locationError = 'Failed to get location: $e');
      if (kDebugMode) print('Location error: $e');
    }
  }

  Future<void> _fetchAgents() async {
    if (_isAgentsLoading || _agents.isNotEmpty) return;
    setState(() => _isAgentsLoading = true);
    try {
      final agentsData = await AgentService.getAgentsByUser(widget.supervisorID);
      setState(() {
        _agents = agentsData.map((data) => Agent.fromJson(data as Map<String, dynamic>)).toList();
      });
    } catch (e) {
      widget.scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(content: Text('Failed to fetch agents: $e')),
      );
    } finally {
      setState(() => _isAgentsLoading = false);
    }
  }

  Future<void> _fetchDelegations() async {
    if (_isDelegationsLoading || _delegations.isNotEmpty) return;
    setState(() => _isDelegationsLoading = true);
    try {
      final delegationsData = await LocationService.getDelegationsByUser(widget.supervisorID);
      setState(() {
        _delegations = delegationsData.map((data) => Delegation.fromJson(data as Map<String, dynamic>)).toList();
      });
    } catch (e) {
      widget.scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(content: Text('Failed to fetch delegations: $e')),
      );
    } finally {
      setState(() => _isDelegationsLoading = false);
    }
  }

  Future<void> _fetchRegions() async {
    if (_isRegionsLoading || _regions.isNotEmpty) return;
    setState(() => _isRegionsLoading = true);
    try {
      final regionsData = await LocationService.getRegionsByUser(widget.supervisorID);
      setState(() {
        _regions = regionsData.map((data) => Region.fromJson(data as Map<String, dynamic>)).toList();
        if (_regions.length == 1) {
          _selectedRegion = _regions[0].regionID;
          _fetchGovernorates(_regions[0].regionID);
        }
      });
    } catch (e) {
      widget.scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(content: Text('Failed to fetch regions: $e')),
      );
    } finally {
      setState(() => _isRegionsLoading = false);
    }
  }

  Future<void> _fetchGovernorates(String regionID) async {
    if (_isGovernoratesLoading || _governorates.any((g) => g.regionID == regionID)) return;
    setState(() => _isGovernoratesLoading = true);
    try {
      final governoratesData = await LocationService.getGovernoratesByRegion(regionID);
      setState(() {
        _governorates = governoratesData.map((data) => Governorate.fromJson(data as Map<String, dynamic>)).toList();
        if (_governorates.length == 1) {
          _selectedGovernorate = _governorates[0].governorateID;
          _fetchRecruitmentDelegations(_governorates[0].governorateID);
        }
      });
    } catch (e) {
      widget.scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(content: Text('Failed to fetch governorates: $e')),
      );
    } finally {
      setState(() => _isGovernoratesLoading = false);
    }
  }

  Future<void> _fetchRecruitmentDelegations(String governorateId) async {
    if (_isRecruitmentDelegationsLoading || _recruitmentDelegations.any((d) => d.governorateID == governorateId)) return;
    setState(() => _isRecruitmentDelegationsLoading = true);
    try {
      final delegationsData = await LocationService.getDelegationsByGovernorate(governorateId);
      setState(() {
        _recruitmentDelegations = delegationsData.map((data) => Delegation.fromJson(data as Map<String, dynamic>)).toList();
        if (_recruitmentDelegations.length == 1) {
          _selectedRecruitmentDelegation = _recruitmentDelegations[0].delegationID;
        }
      });
    } catch (e) {
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 8),
        isLoading
            ? const Center(child: CircularProgressIndicator())
            : Wrap(
          spacing: 8,
          children: items.map((item) {
            final isSelected = selectedItems.contains(item);
            return ChoiceChip(
              label: Text(formatter(item)),
              selected: isSelected,
              onSelected: (selected) {
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
                  onPressed: () => Navigator.pop(context),
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
                        onTap: () {},
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
                            child: TextFormField(
                              initialValue: _startTime,
                              decoration: const InputDecoration(
                                labelText: 'Start Time (HH:mm)',
                                border: OutlineInputBorder(),
                              ),
                              keyboardType: TextInputType.datetime,
                              validator: (value) {
                                if (value == null || !RegExp(r'^(?:[01]\d|2[0-3]):[0-5]\d$').hasMatch(value)) {
                                  return 'Enter valid time (HH:mm, 00:00-23:59)';
                                }
                                return null;
                              },
                              onSaved: (value) => _startTime = value!,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextFormField(
                              initialValue: _endTime,
                              decoration: const InputDecoration(
                                labelText: 'End Time (HH:mm)',
                                border: OutlineInputBorder(),
                              ),
                              keyboardType: TextInputType.datetime,
                              validator: (value) {
                                if (value == null || !RegExp(r'^(?:[01]\d|2[0-3]):[0-5]\d$').hasMatch(value)) {
                                  return 'Enter valid time (HH:mm, 00:00-23:59)';
                                }
                                final start = DateTime.parse('2000-01-01 $_startTime:00');
                                final end = DateTime.parse('2000-01-01 $value:00');
                                if (end.isBefore(start) || end.isAtSameMomentAs(start)) {
                                  return 'End time must be after start time';
                                }
                                return null;
                              },
                              onSaved: (value) => _endTime = value!,
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
                          if (_formKey.currentState!.validate()) {
                            if (_userLocation == null) {
                              widget.scaffoldMessengerKey.currentState?.showSnackBar(
                                const SnackBar(content: Text('Location not available')),
                              );
                              return;
                            }
                            _formKey.currentState!.save();
                            setState(() => _isLoading = true);
                            final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);
                            try {
                              final startHour = int.parse(_startTime.split(':')[0]);
                              final endHour = int.parse(_endTime.split(':')[0]);
                              final recruitmentAreas = _includeRecruitmentVisits
                                  ? [
                                if (_selectedRegion != null)
                                  _regions.firstWhere((r) => r.regionID == _selectedRegion).name,
                                if (_selectedGovernorate != null)
                                  _governorates
                                      .firstWhere((g) => g.governorateID == _selectedGovernorate)
                                      .name,
                                if (_selectedRecruitmentDelegation != null)
                                  _recruitmentDelegations
                                      .firstWhere((d) => d.delegationID == _selectedRecruitmentDelegation)
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
                              final coordinates = {
                                'lat': _userLocation!.latitude,
                                'lng': _userLocation!.longitude,
                              };
                              final result = await timesheetProvider.suggestTimesheet(
                                supervisorID: widget.supervisorID,
                                weekNumber: widget.weekNumber,
                                year: widget.year,
                                coordinates: coordinates,
                                criteria: criteria,
                              );
                              final suggestedVisits = (result['suggestions'] as List)
                                  .map((v) => Visit.fromJson(v as Map<String, dynamic>))
                                  .toList();
                              timesheetProvider.setSuggestedVisits(suggestedVisits);
                              setState(() {
                                _showSuggestions = true;
                                _isLoading = false;
                              });
                            } catch (e) {
                              setState(() => _isLoading = false);
                              widget.scaffoldMessengerKey.currentState?.showSnackBar(
                                SnackBar(content: Text('Failed to generate suggestions: $e')),
                              );
                            }
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
                        child: ListView.builder(
                          shrinkWrap: true,
                          itemCount: timesheetProvider.suggestedVisits.length,
                          itemBuilder: (context, index) {
                            final visit = timesheetProvider.suggestedVisits[index];
                            return VisitItem(
                              visit: visit,
                              isSuggested: true,
                              isDraggable: false,
                              onToggleSelection: (visitID) {
                                timesheetProvider.toggleSuggestedVisitSelection(visitID);
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
                                  await timesheetProvider.fetchTimesheetsBySupervisor(widget.supervisorID);
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