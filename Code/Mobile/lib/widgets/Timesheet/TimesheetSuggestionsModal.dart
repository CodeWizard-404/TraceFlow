import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
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
import 'dart:convert';

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

  // Cache key for SharedPreferences
  static const String _cacheKey = 'suggested_visits';

  @override
  void initState() {
    super.initState();
    _startTime = '08:00';
    _endTime = '17:00';
    _fetchUserLocation();
    _fetchAgents();
    _fetchDelegations();
    _restoreCachedVisits();
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
    if (_isGovernoratesLoading || _governorates.any((g) => g.regionID! == regionID)) return;
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

  Future<void> _cacheSuggestedVisits(List<Visit> visits) async {
    final prefs = await SharedPreferences.getInstance();
    final visitsJson = visits.map((visit) => jsonEncode(visit.toJson())).toList();
    await prefs.setStringList(_cacheKey, visitsJson);
    if (kDebugMode) print('Cached ${visits.length} suggested visits');
  }

  Future<List<Visit>> _loadCachedVisits() async {
    final prefs = await SharedPreferences.getInstance();
    final visitsJson = prefs.getStringList(_cacheKey);
    if (visitsJson == null || visitsJson.isEmpty) {
      if (kDebugMode) print('No cached visits found');
      return [];
    }
    try {
      final visits = visitsJson
          .map((json) => Visit.fromJson(jsonDecode(json) as Map<String, dynamic>))
          .toList();
      if (kDebugMode) print('Loaded ${visits.length} cached visits');
      return visits;
    } catch (e) {
      if (kDebugMode) print('Error loading cached visits: $e');
      return [];
    }
  }

  Future<void> _clearCachedVisits() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cacheKey);
    if (kDebugMode) print('Cleared cached visits');
  }

  Future<void> _restoreCachedVisits() async {
    final cachedVisits = await _loadCachedVisits();
    if (cachedVisits.isNotEmpty) {
      final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);
      timesheetProvider.setSuggestedVisits(cachedVisits);
      setState(() {
        _showSuggestions = true;
      });
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

  Future<void> _showMultiSelectDialog({
    required String title,
    required List<String> items,
    required List<String> selectedItems,
    required String Function(String) displayFormatter,
    required Function(List<String>) onSelectionChanged,
  }) async {
    final TextEditingController searchController = TextEditingController();
    List<String> filteredItems = List.from(items);
    List<String> tempSelected = List.from(selectedItems);

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: Theme.of(context).cardTheme.color,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          title: Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
          content: SizedBox(
            width: double.maxFinite,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: searchController,
                  decoration: InputDecoration(
                    hintText: 'Search...',
                    prefixIcon: Icon(
                      Icons.search,
                      color: Theme.of(context).colorScheme.primary,
                      size: 18,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.primary,
                        width: 1.5,
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.primary.withOpacity(0.7),
                        width: 1.5,
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.primary,
                        width: 2,
                      ),
                    ),
                  ),
                  onChanged: (value) {
                    setDialogState(() {
                      filteredItems = items.where((item) =>
                          displayFormatter(item).toLowerCase().contains(value.toLowerCase())).toList();
                    });
                  },
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 300,
                  child: ListView.builder(
                    itemCount: filteredItems.length,
                    itemBuilder: (context, index) {
                      final item = filteredItems[index];
                      final isSelected = tempSelected.contains(item);
                      return ListTile(
                        leading: Icon(
                          Icons.list,
                          color: Theme.of(context).colorScheme.primary,
                          size: 18,
                        ),
                        title: Text(
                          displayFormatter(item),
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context).colorScheme.onSurface,
                          ),
                        ),
                        trailing: Checkbox(
                          value: isSelected,
                          onChanged: (bool? value) {
                            setDialogState(() {
                              if (value == true) {
                                tempSelected.add(item);
                              } else {
                                tempSelected.remove(item);
                              }
                            });
                          },
                          activeColor: Theme.of(context).colorScheme.primary,
                        ),
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
              child: Text(
                'Cancel',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () {
                onSelectionChanged(tempSelected);
                Navigator.pop(context);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Theme.of(context).colorScheme.primary,
                foregroundColor: Theme.of(context).colorScheme.onPrimary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Apply'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMultiSelector({
    required String label,
    required String value,
    required VoidCallback onTap,
    required bool isLoading,
    required bool isEmpty,
  }) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: InkWell(
        onTap: isLoading || isEmpty ? null : onTap,
        borderRadius: BorderRadius.circular(8),
        splashColor: theme.colorScheme.primary.withOpacity(0.2),
        highlightColor: theme.colorScheme.primary.withOpacity(0.1),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            border: Border.all(
              color: isLoading || isEmpty
                  ? theme.colorScheme.onSurface.withOpacity(0.3)
                  : theme.colorScheme.primary.withOpacity(0.7),
              width: 1.5,
            ),
            borderRadius: BorderRadius.circular(8),
            color: isLoading || isEmpty
                ? theme.colorScheme.background.withOpacity(0.5)
                : theme.colorScheme.background,
          ),
          child: Row(
            children: [
              Icon(
                Icons.list,
                color: isLoading || isEmpty
                    ? theme.colorScheme.onSurface.withOpacity(0.5)
                    : theme.colorScheme.primary,
                size: 18,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: isLoading || isEmpty
                            ? theme.colorScheme.onSurface.withOpacity(0.5)
                            : theme.colorScheme.onSurface.withOpacity(0.7),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      isLoading
                          ? 'Loading...'
                          : isEmpty
                          ? 'No $label available'
                          : value,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: isLoading || isEmpty
                            ? theme.colorScheme.onSurface.withOpacity(0.5)
                            : theme.colorScheme.onSurface,
                        fontWeight: FontWeight.w500,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.arrow_drop_down,
                color: isLoading || isEmpty
                    ? theme.colorScheme.onSurface.withOpacity(0.5)
                    : theme.colorScheme.primary,
                size: 24,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSelector({
    required String label,
    required String value,
    required VoidCallback onTap,
  }) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        splashColor: theme.colorScheme.primary.withOpacity(0.2),
        highlightColor: theme.colorScheme.primary.withOpacity(0.1),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            border: Border.all(
              color: theme.colorScheme.primary.withOpacity(0.7),
              width: 1.5,
            ),
            borderRadius: BorderRadius.circular(8),
            color: theme.colorScheme.background,
          ),
          child: Row(
            children: [
              Icon(
                Icons.arrow_drop_down,
                color: theme.colorScheme.primary,
                size: 18,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurface.withOpacity(0.7),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      value,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurface,
                        fontWeight: FontWeight.w500,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.arrow_drop_down,
                color: theme.colorScheme.primary,
                size: 24,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionCard({required String title, required List<Widget> children}) {
    final theme = Theme.of(context);
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: theme.colorScheme.primary.withOpacity(0.7),
          width: 1.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Text(
              title,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: theme.colorScheme.primary,
              ),
            ),
          ),
          const Divider(height: 1, thickness: 1, color: Colors.grey),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(children: children),
          ),
        ],
      ),
    );
  }

  String _formatSelectedDays(List<String> days) {
    return days.isEmpty ? 'Select days' : '${days.length} days selected';
  }

  String _formatSelectedDelegations(List<String> delegations) {
    return delegations.isEmpty ? 'Select delegations' : '${delegations.length} delegations selected';
  }

  String _formatSelectedAgents(List<String> agents) {
    return agents.isEmpty ? 'Select agents' : '${agents.length} agents selected';
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
        padding: const EdgeInsets.all(8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: Text(
                    'Timesheet Suggestions',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: theme.colorScheme.primary,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () {
                    Navigator.pop(context); // Close modal without clearing cache
                  },
                ),
              ],
            ),
            if (_locationError != null)
              Padding(
                padding: const EdgeInsets.all(8),
                child: Text(
                  _locationError!,
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ),
            Expanded(
              child: _showSuggestions
                  ? _buildSuggestionsView(timesheetProvider)
                  : _buildFormView(weekDates),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFormView(List<String> weekDates) {
    return Form(
      key: _formKey,
      child: ListView(
        children: [
          _buildSectionCard(
            title: 'Selections',
            children: [
              _buildMultiSelector(
                label: 'Preferred Days',
                value: _formatSelectedDays(_preferredDays),
                onTap: () {
                  _showMultiSelectDialog(
                    title: 'Select Preferred Days',
                    items: weekDates,
                    selectedItems: _preferredDays,
                    displayFormatter: (date) => DateFormat('EEE, d MMM').format(DateTime.parse(date)),
                    onSelectionChanged: (selected) {
                      setState(() {
                        _preferredDays = selected;
                      });
                    },
                  );
                },
                isLoading: false,
                isEmpty: weekDates.isEmpty,
              ),
              _buildMultiSelector(
                label: 'Delegations',
                value: _formatSelectedDelegations(_delegationIds),
                onTap: () {
                  _showMultiSelectDialog(
                    title: 'Select Delegations',
                    items: _delegations.map((d) => d.delegationID).toList(),
                    selectedItems: _delegationIds,
                    displayFormatter: (id) => _delegations.firstWhere((d) => d.delegationID == id).name,
                    onSelectionChanged: (selected) {
                      setState(() {
                        _delegationIds = selected;
                      });
                    },
                  );
                },
                isLoading: _isDelegationsLoading,
                isEmpty: _delegations.isEmpty,
              ),
              _buildMultiSelector(
                label: 'Agents',
                value: _formatSelectedAgents(_agentIds),
                onTap: () {
                  _showMultiSelectDialog(
                    title: 'Select Agents',
                    items: _agents.map((a) => a.agentID).toList(),
                    selectedItems: _agentIds,
                    displayFormatter: (id) {
                      final agent = _agents.firstWhere((a) => a.agentID == id);
                      return '${agent.name} ${agent.lastname}';
                    },
                    onSelectionChanged: (selected) {
                      setState(() {
                        _agentIds = selected;
                      });
                    },
                  );
                },
                isLoading: _isAgentsLoading,
                isEmpty: _agents.isEmpty,
              ),
            ],
          ),
          const SizedBox(height: 8),
          _buildSectionCard(
            title: 'Options',
            children: [
              CheckboxListTile(
                title: Text(
                  'Include Recruitment Visits',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                value: _includeRecruitmentVisits,
                onChanged: (value) {
                  setState(() {
                    _includeRecruitmentVisits = value!;
                    if (!value) {
                      _selectedRegion = null;
                      _selectedGovernorate = null;
                      _selectedRecruitmentDelegation = null;
                    } else {
                      _fetchRegions();
                    }
                  });
                },
                activeColor: Theme.of(context).colorScheme.primary,
              ),
              if (_includeRecruitmentVisits) ...[
                _isRegionsLoading
                    ? const Center(child: CircularProgressIndicator())
                    : _buildSelector(
                  label: 'Region',
                  value: _selectedRegion == null
                      ? 'Select Region'
                      : _regions.firstWhere((r) => r.regionID == _selectedRegion).name,
                  onTap: () {
                    showDialog(
                      context: context,
                      builder: (context) => AlertDialog(
                        backgroundColor: Theme.of(context).cardTheme.color,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        title: Text(
                          'Select Region',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                        content: SizedBox(
                          width: double.maxFinite,
                          child: ListView.builder(
                            shrinkWrap: true,
                            itemCount: _regions.length,
                            itemBuilder: (context, index) {
                              final region = _regions[index];
                              return ListTile(
                                title: Text(region.name),
                                onTap: () {
                                  setState(() {
                                    _selectedRegion = region.regionID;
                                    _selectedGovernorate = null;
                                    _selectedRecruitmentDelegation = null;
                                    _fetchGovernorates(region.regionID);
                                  });
                                  Navigator.pop(context);
                                },
                              );
                            },
                          ),
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 8),
                _isGovernoratesLoading
                    ? const Center(child: CircularProgressIndicator())
                    : _buildSelector(
                  label: 'Governorate',
                  value: _selectedGovernorate == null
                      ? 'Select Governorate'
                      : _governorates.firstWhere((g) => g.governorateID == _selectedGovernorate).name,
                  onTap: _selectedRegion == null
                      ? () {}
                      : () {
                    showDialog(
                      context: context,
                      builder: (context) => AlertDialog(
                        backgroundColor: Theme.of(context).cardTheme.color,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        title: Text(
                          'Select Governorate',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                        content: SizedBox(
                          width: double.maxFinite,
                          child: ListView.builder(
                            shrinkWrap: true,
                            itemCount: _governorates.length,
                            itemBuilder: (context, index) {
                              final governorate = _governorates[index];
                              return ListTile(
                                title: Text(governorate.name),
                                onTap: () {
                                  setState(() {
                                    _selectedGovernorate = governorate.governorateID;
                                    _selectedRecruitmentDelegation = null;
                                    _fetchRecruitmentDelegations(governorate.governorateID);
                                  });
                                  Navigator.pop(context);
                                },
                              );
                            },
                          ),
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 8),
                _isRecruitmentDelegationsLoading
                    ? const Center(child: CircularProgressIndicator())
                    : _buildSelector(
                  label: 'Recruitment Delegation',
                  value: _selectedRecruitmentDelegation == null
                      ? 'Select Delegation'
                      : _recruitmentDelegations.firstWhere((d) => d.delegationID == _selectedRecruitmentDelegation).name,
                  onTap: _selectedGovernorate == null
                      ? () {}
                      : () {
                    showDialog(
                      context: context,
                      builder: (context) => AlertDialog(
                        backgroundColor: Theme.of(context).cardTheme.color,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        title: Text(
                          'Select Delegation',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                        content: SizedBox(
                          width: double.maxFinite,
                          child: ListView.builder(
                            shrinkWrap: true,
                            itemCount: _recruitmentDelegations.length,
                            itemBuilder: (context, index) {
                              final delegation = _recruitmentDelegations[index];
                              return ListTile(
                                title: Text(delegation.name),
                                onTap: () {
                                  setState(() {
                                    _selectedRecruitmentDelegation = delegation.delegationID;
                                  });
                                  Navigator.pop(context);
                                },
                              );
                            },
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          _buildSectionCard(
            title: 'Time Interval',
            children: [
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
                          decoration: InputDecoration(
                            labelText: 'Start Time (HH:mm)',
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
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
                          decoration: InputDecoration(
                            labelText: 'End Time (HH:mm)',
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
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
            ],
          ),
          const SizedBox(height: 8),
          _buildSectionCard(
            title: 'Additional Settings',
            children: [
              TextFormField(
                initialValue: _maxVisitsPerAgentPerWeek.toString(),
                decoration: InputDecoration(
                  labelText: 'Max Visits Per Agent Per Week',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
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
              const SizedBox(height: 8),
              TextFormField(
                initialValue: _description,
                decoration: InputDecoration(
                  labelText: 'Description',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                maxLines: 3,
                onSaved: (value) => _description = value ?? '',
              ),
            ],
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
              final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);
              try {
                if (kDebugMode) print('Parsing startHour and endHour');
                final startHour = int.tryParse(_startTime.split(':')[0]) ?? 8;
                final endHour = int.tryParse(_endTime.split(':')[0]) ?? 17;
                if (kDebugMode) print('Building criteria');
                final recruitmentAreas = _includeRecruitmentVisits
                    ? [
                  if (_selectedRegion != null)
                    _regions.firstWhere((r) => r.regionID == _selectedRegion).name,
                  if (_selectedGovernorate != null)
                    _governorates.firstWhere((g) => g.governorateID == _selectedGovernorate).name,
                  if (_selectedRecruitmentDelegation != null)
                    _recruitmentDelegations.firstWhere((d) => d.delegationID == _selectedRecruitmentDelegation).name,
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
                await _cacheSuggestedVisits(suggestedVisits); // Cache the visits
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
              backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.8),
              foregroundColor: Theme.of(context).colorScheme.onPrimary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Generate Suggestions'),
          ),
        ],
      ),
    );
  }

  Widget _buildSuggestionsView(TimesheetProvider timesheetProvider) {
    final theme = Theme.of(context);
    if (timesheetProvider.isLoading) {
      return const Center(child: CircularProgressIndicator());
    } else if (timesheetProvider.suggestedVisits.isEmpty) {
      return const Center(child: Text('No suggestions available'));
    } else {
      return Column(
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
                _cacheSuggestedVisits(currentVisits); // Update cache after reordering
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
                    _clearCachedVisits(); // Clear cache on cancel
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
                      await _clearCachedVisits(); // Clear cache on save
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
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('Save'),
                ),
              ],
            ),
        ],
      );
    }
  }
}