import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import '../../models/agent.dart';
import '../../models/checklist.dart';
import '../../models/reason.dart';
import '../../providers/auth_provider.dart';
import '../../providers/timesheet_provider.dart';
import '../../providers/agent_provider.dart';
import '../../providers/checklist_provider.dart';
import '../../providers/reason_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/user_provider.dart';
import '../../services/location_service.dart';
import '../../widgets/appbar/app_bar.dart';
import '../../widgets/appbar/sidebar.dart';
import '../../widgets/commen/button.dart';
import '../../widgets/commen/spacer.dart';

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
  List<Checklist> _selectedChecklists = [];
  List<Reason> _selectedReasons = [];
  String? _selectedRegionId;
  String? _selectedGovernorateId;
  String? _selectedDelegationId;
  String _agentPhone = '';
  String? _phoneError;
  Timer? _debounce;
  final TextEditingController _phoneController = TextEditingController();
  bool _isLoading = false;
  List<dynamic> _regions = [];

  @override
  void initState() {
    super.initState();
    if (kDebugMode)
      print(
        'CreateVisitScreen initState, week: ${widget.weekNumber}, year: ${widget.year}',
      );
    final calculatedDate = DateTime(
      widget.year,
      1,
      1,
    ).add(Duration(days: (widget.weekNumber - 1) * 7));
    final now = DateTime.now();
    _selectedDate = calculatedDate.isBefore(now) ? now : calculatedDate;
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadInitialData());
  }

  @override
  void dispose() {
    if (kDebugMode) print('Disposing CreateVisitScreen');
    _debounce?.cancel();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    if (kDebugMode) print('Loading initial data');
    setState(() => _isLoading = true);
    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      final locationProvider = Provider.of<LocationProvider>(
        context,
        listen: false,
      );
      final checklistProvider = Provider.of<ChecklistProvider>(
        context,
        listen: false,
      );
      final reasonProvider = Provider.of<ReasonProvider>(
        context,
        listen: false,
      );

      final supervisorID = authProvider.user!.userID;
      await userProvider.getRegionalManagerBySupervisor(supervisorID);
      final regionalManagerID = userProvider.currentUser?.userID;

      if (regionalManagerID != null) {
        await locationProvider.getRegionsByUser(regionalManagerID);
        _regions = locationProvider.regions;
      } else {
        await locationProvider.getAllRegions();
        _regions = locationProvider.regions;
      }

      await Future.wait([
        checklistProvider.getAllChecklists(),
        reasonProvider.getAllReasons(),
      ]);

      if (kDebugMode) print('Initial data loaded successfully');
    } catch (e) {
      if (kDebugMode) print('Error loading initial data: $e');
      _showSnackBar('Failed to load initial data: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  int _getWeekNumber(DateTime date) {
    final utcDate = DateTime.utc(date.year, date.month, date.day);
    final dayOfWeek = utcDate.weekday % 7;
    final adjustedDate = utcDate.add(
      Duration(days: 4 - (dayOfWeek == 0 ? 7 : dayOfWeek)),
    );
    final yearStart = DateTime.utc(adjustedDate.year, 1, 1);
    final diffMillis =
        adjustedDate.millisecondsSinceEpoch - yearStart.millisecondsSinceEpoch;
    final diffDays = diffMillis / 86400000;
    return ((diffDays + 1) / 7).ceil();
  }

  Future<void> _selectDate(BuildContext context) async {
    final now = DateTime.now();
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
      builder:
          (context, child) => Theme(
            data: Theme.of(context).copyWith(
              colorScheme: Theme.of(context).colorScheme.copyWith(
                primary: Theme.of(context).colorScheme.primary,
                onPrimary: Theme.of(context).colorScheme.onPrimary,
                surface: Theme.of(context).colorScheme.surface,
                onSurface: Theme.of(context).colorScheme.onSurface,
              ),
            ),
            child: child!,
          ),
    );
    if (picked != null && picked != _selectedDate) {
      setState(() {
        _selectedDate = picked;
        if (kDebugMode) print('Date selected: $_selectedDate');
      });
    }
  }

  Future<void> _selectTime(BuildContext context) async {
    final now = DateTime.now();
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: _selectedTime ?? TimeOfDay.now(),
      builder:
          (context, child) => Theme(
            data: Theme.of(context).copyWith(
              colorScheme: Theme.of(context).colorScheme.copyWith(
                primary: Theme.of(context).colorScheme.primary,
                onPrimary: Theme.of(context).colorScheme.onPrimary,
              ),
            ),
            child: child!,
          ),
    );
    if (picked != null && picked != _selectedTime) {
      final selectedDate = _selectedDate ?? now;
      final selectedDateTime = DateTime(
        selectedDate.year,
        selectedDate.month,
        selectedDate.day,
        picked.hour,
        picked.minute,
      );
      if (selectedDate.day == now.day && selectedDateTime.isBefore(now)) {
        _showSnackBar('Time cannot be before now for today');
        return;
      }
      setState(() {
        _selectedTime = picked;
        if (kDebugMode)
          print('Time selected: ${_selectedTime!.format(context)}');
      });
    }
  }

  Future<void> _showLocationDialog(BuildContext context, String type) async {
    final locationProvider = Provider.of<LocationProvider>(
      context,
      listen: false,
    );
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    List<dynamic> items;
    String? selectedValue;

    switch (type) {
      case 'region':
        items = _regions;
        selectedValue = _selectedRegionId;
        break;
      case 'governorate':
        final regionGovs = await LocationService.getGovernoratesByRegion(
          _selectedRegionId!,
        );
        final supervisorGovs = await LocationService.getGovernoratesByUser(
          authProvider.user!.userID,
        );
        items =
            regionGovs
                .where(
                  (g) => supervisorGovs.any(
                    (sg) => sg['governorateID'] == g['governorateID'],
                  ),
                )
                .toList();
        selectedValue = _selectedGovernorateId;
        break;
      case 'delegation':
        final govDels = await LocationService.getDelegationsByGovernorate(
          _selectedGovernorateId!,
        );
        final supervisorDels = await LocationService.getDelegationsByUser(
          authProvider.user!.userID,
        );
        items =
            govDels
                .where(
                  (d) => supervisorDels.any(
                    (sd) => sd['delegationID'] == d['delegationID'],
                  ),
                )
                .toList();
        selectedValue = _selectedDelegationId;
        break;
      default:
        return;
    }

    final TextEditingController searchController = TextEditingController();
    List<dynamic> filteredItems = List.from(items);

    await showDialog(
      context: context,
      builder:
          (context) => StatefulBuilder(
            builder:
                (context, setDialogState) => AlertDialog(
                  backgroundColor: Theme.of(context).cardTheme.color,
                  title: Text(
                    'Select $type',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  content: SizedBox(
                    width: double.maxFinite,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextField(
                          controller: searchController,
                          decoration: InputDecoration(
                            hintText: 'Search ${type}s...',
                            prefixIcon: Icon(
                              Icons.search,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onChanged: (value) {
                            setDialogState(() {
                              filteredItems =
                                  items
                                      .where(
                                        (item) => item['name']
                                            .toLowerCase()
                                            .contains(value.toLowerCase()),
                                      )
                                      .toList();
                            });
                          },
                        ),
                        const CustomSpacer(height: 12),
                        SizedBox(
                          height: 300,
                          child: ListView.builder(
                            itemCount: filteredItems.length,
                            itemBuilder: (context, index) {
                              final item = filteredItems[index];
                              return RadioListTile<String>(
                                title: Text(item['name']),
                                value: item['${type}ID'],
                                groupValue: selectedValue,
                                onChanged: (value) {
                                  setState(() {
                                    if (type == 'region') {
                                      _selectedRegionId = value;
                                      _selectedGovernorateId = null;
                                      _selectedDelegationId = null;
                                    } else if (type == 'governorate') {
                                      _selectedGovernorateId = value;
                                      _selectedDelegationId = null;
                                    } else {
                                      _selectedDelegationId = value;
                                    }
                                    _selectedAgentId = null;
                                    _phoneController.clear();
                                    _agentPhone = '';
                                    _phoneError = null;
                                  });
                                  Navigator.pop(context);
                                },
                                activeColor:
                                    Theme.of(context).colorScheme.primary,
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
                          color: Theme.of(
                            context,
                          ).colorScheme.onSurface.withOpacity(0.6),
                        ),
                      ),
                    ),
                  ],
                ),
          ),
    );
  }

  Future<void> _showAgentDialog(
      BuildContext context,
      AgentProvider agentProvider,
      ) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    setState(() => _isLoading = true);
    try {
      await agentProvider.getAgentsByUser(authProvider.user!.userID);
      final supervisorAgents = List<Agent>.from(agentProvider.agents);
      await agentProvider.fetchAgentsByDelegation(_selectedDelegationId!);
      final delegationAgents = agentProvider.agents;
      final filteredAgents = supervisorAgents
          .where((a) => delegationAgents.any((da) => da.agentID == a.agentID))
          .toList();

      setState(() => _isLoading = false);

      final TextEditingController searchController = TextEditingController();
      List<Agent> filteredItems = List.from(filteredAgents);

      await showDialog(
        context: context,
        builder: (context) => StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            backgroundColor: Theme.of(context).cardTheme.color,
            title: Text(
              'Select Agent',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            content: SizedBox(
              width: double.maxFinite,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: searchController,
                    decoration: InputDecoration(
                      hintText: 'Search agents...',
                      prefixIcon: Icon(
                        Icons.search,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onChanged: (value) {
                      setDialogState(() {
                        filteredItems = filteredAgents
                            .where(
                              (agent) =>
                          '${agent.name} ${agent.lastname}'
                              .toLowerCase()
                              .contains(value.toLowerCase()) ||
                              agent.agentID
                                  .toLowerCase()
                                  .contains(value.toLowerCase()),
                        )
                            .toList();
                      });
                    },
                  ),
                  const CustomSpacer(height: 12),
                  SizedBox(
                    height: 300,
                    child: filteredItems.isEmpty
                        ? const Center(child: Text('No agents available'))
                        : ListView.builder(
                      itemCount: filteredItems.length,
                      itemBuilder: (context, index) {
                        final agent = filteredItems[index];
                        return RadioListTile<String>(
                          title: Text('${agent.name} ${agent.lastname}'),
                          value: agent.agentID,
                          groupValue: _selectedAgentId,
                          onChanged: (value) {
                            setState(() {
                              _selectedAgentId = value;
                              _phoneController.text = agent.phone ?? '';
                              _agentPhone = agent.phone ?? '';
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
                child: Text(
                  'Cancel',
                  style: TextStyle(
                    color:
                    Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    } catch (e) {
      setState(() => _isLoading = false);
      _showSnackBar('Failed to load agents: $e');
      if (kDebugMode) print('Error in _showAgentDialog: $e');
    }
  }

  Future<void> _showChecklistDialog(
    BuildContext context,
    ChecklistProvider checklistProvider,
  ) async {
    final allChecklists = checklistProvider.allChecklists;
    final selectedChecklists = List<Checklist>.from(_selectedChecklists);
    final TextEditingController searchController = TextEditingController();
    List<Checklist> filteredChecklists = List.from(allChecklists);

    await showDialog(
      context: context,
      builder:
          (context) => StatefulBuilder(
            builder:
                (context, setDialogState) => AlertDialog(
                  backgroundColor: Theme.of(context).cardTheme.color,
                  title: Text(
                    'Select Checklists',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  content: SizedBox(
                    width: double.maxFinite,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextField(
                          controller: searchController,
                          decoration: InputDecoration(
                            hintText: 'Search checklists...',
                            prefixIcon: Icon(
                              Icons.search,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onChanged: (value) {
                            setDialogState(() {
                              filteredChecklists =
                                  allChecklists
                                      .where(
                                        (checklist) => checklist.item
                                            .toLowerCase()
                                            .contains(value.toLowerCase()),
                                      )
                                      .toList();
                            });
                          },
                        ),
                        const CustomSpacer(height: 12),
                        SizedBox(
                          height: 300,
                          child: ListView.builder(
                            itemCount: filteredChecklists.length,
                            itemBuilder: (context, index) {
                              final checklist = filteredChecklists[index];
                              final isSelected = selectedChecklists.any(
                                (c) => c.checklistID == checklist.checklistID,
                              );
                              return CheckboxListTile(
                                title: Text(checklist.item),
                                value: isSelected,
                                onChanged: (value) {
                                  setDialogState(() {
                                    if (value == true) {
                                      selectedChecklists.add(checklist);
                                    } else {
                                      selectedChecklists.removeWhere(
                                        (c) =>
                                            c.checklistID ==
                                            checklist.checklistID,
                                      );
                                    }
                                  });
                                },
                                activeColor:
                                    Theme.of(context).colorScheme.primary,
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
                          color: Theme.of(
                            context,
                          ).colorScheme.onSurface.withOpacity(0.6),
                        ),
                      ),
                    ),
                    CustomButton(
                      label: 'Confirm',
                      onPressed: () {
                        setState(
                          () => _selectedChecklists = selectedChecklists,
                        );
                        Navigator.pop(context);
                      },
                    ),
                  ],
                ),
          ),
    );
  }

  Future<void> _showReasonDialog(
    BuildContext context,
    ReasonProvider reasonProvider,
  ) async {
    final allReasons = reasonProvider.allReasons;
    final selectedReasons = List<Reason>.from(_selectedReasons);
    final TextEditingController searchController = TextEditingController();
    List<Reason> filteredReasons = List.from(allReasons);

    await showDialog(
      context: context,
      builder:
          (context) => StatefulBuilder(
            builder:
                (context, setDialogState) => AlertDialog(
                  backgroundColor: Theme.of(context).cardTheme.color,
                  title: Text(
                    'Select Reasons',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  content: SizedBox(
                    width: double.maxFinite,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextField(
                          controller: searchController,
                          decoration: InputDecoration(
                            hintText: 'Search reasons...',
                            prefixIcon: Icon(
                              Icons.search,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onChanged: (value) {
                            setDialogState(() {
                              filteredReasons =
                                  allReasons
                                      .where(
                                        (reason) => reason.item
                                            .toLowerCase()
                                            .contains(value.toLowerCase()),
                                      )
                                      .toList();
                            });
                          },
                        ),
                        const CustomSpacer(height: 12),
                        SizedBox(
                          height: 300,
                          child: ListView.builder(
                            itemCount: filteredReasons.length,
                            itemBuilder: (context, index) {
                              final reason = filteredReasons[index];
                              final isSelected = selectedReasons.any(
                                (r) => r.reasonID == reason.reasonID,
                              );
                              return CheckboxListTile(
                                title: Text(reason.item),
                                value: isSelected,
                                onChanged: (value) {
                                  setDialogState(() {
                                    if (value == true) {
                                      selectedReasons.add(reason);
                                    } else {
                                      selectedReasons.removeWhere(
                                        (r) => r.reasonID == reason.reasonID,
                                      );
                                    }
                                  });
                                },
                                activeColor:
                                    Theme.of(context).colorScheme.primary,
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
                          color: Theme.of(
                            context,
                          ).colorScheme.onSurface.withOpacity(0.6),
                        ),
                      ),
                    ),
                    CustomButton(
                      label: 'Confirm',
                      onPressed: () {
                        setState(() => _selectedReasons = selectedReasons);
                        Navigator.pop(context);
                      },
                    ),
                  ],
                ),
          ),
    );
  }

  Future<void> _onPhoneChanged(String value, AgentProvider agentProvider) async {
    setState(() {
      _agentPhone = value;
      _phoneError = null;
    });
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () async {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (value.isEmpty) {
        setState(() {
          _selectedAgentId = null;
          _selectedRegionId = null;
          _selectedGovernorateId = null;
          _selectedDelegationId = null;
          _phoneError = null;
        });
      } else if (value.length >= 8) {
        setState(() => _isLoading = true);
        try {
          await agentProvider.fetchAgentByPhone(value);
          final agent = agentProvider.currentAgent;
          if (agent != null) {
            try {
              await agentProvider.getAgentsByUser(authProvider.user!.userID);
              final supervisorAgents = agentProvider.agents;
              if (supervisorAgents.any((a) => a.agentID == agent.agentID)) {
                setState(() {
                  _selectedAgentId = agent.agentID;
                  _selectedDelegationId = agent.delegationID;
                  _phoneError = null;
                });
                // Fetch location details
                final locationDetails =
                await LocationService.getLocationDetailsById(
                    agent.delegationID);
                if (kDebugMode) print('Location details: $locationDetails');
                if (locationDetails.containsKey('success') &&
                    locationDetails['success'] == true &&
                    locationDetails.containsKey('address')) {
                  if (kDebugMode)
                    print('Valid location address: ${locationDetails['address']}');
                  setState(() {
                    _selectedRegionId = locationDetails['regionID'] as String?;
                    _selectedGovernorateId =
                    locationDetails['governorateID'] as String?;
                  });
                } else {
                  if (kDebugMode)
                    print('Invalid or missing location details: $locationDetails');
                  setState(() {
                    _phoneError = 'Invalid location data for agent';
                  });
                }
              } else {
                setState(() {
                  _phoneError = 'Agent not assigned to supervisor';
                  _selectedAgentId = null;
                  _selectedDelegationId = null;
                });
              }
            } catch (e) {
              setState(() {
                _phoneError = 'Error fetching supervisor agents: $e';
                _selectedAgentId = null;
                _selectedDelegationId = null;
              });
              if (kDebugMode) print('Error fetching supervisor agents: $e');
            }
          } else {
            setState(() {
              _phoneError = 'Agent not found';
              _selectedAgentId = null;
              _selectedDelegationId = null;
            });
          }
        } catch (e) {
          setState(() {
            _phoneError = 'Error fetching agent: $e';
            _selectedAgentId = null;
            _selectedDelegationId = null;
          });
          if (kDebugMode) print('Error in _onPhoneChanged: $e');
        } finally {
          setState(() => _isLoading = false);
        }
      }
    });
  }


  bool _validateInputs() {
    final now = DateTime.now();
    final selectedDate = _selectedDate ?? now;
    final selectedTime = _selectedTime ?? TimeOfDay.now();
    final selectedDateTime = DateTime(
      selectedDate.year,
      selectedDate.month,
      selectedDate.day,
      selectedTime.hour,
      selectedTime.minute,
    );

    if (selectedDate.isBefore(DateTime(now.year, now.month, now.day))) {
      _showSnackBar('Date cannot be before today');
      return false;
    }
    if (selectedDate.day == now.day && selectedDateTime.isBefore(now)) {
      _showSnackBar('Time cannot be before now for today');
      return false;
    }
    if (_selectedAgentId == null) {
      _showSnackBar('An agent must be selected');
      return false;
    }
    if (_selectedDelegationId == null) {
      _showSnackBar('A delegation must be selected');
      return false;
    }
    if (_selectedChecklists.isEmpty) {
      _showSnackBar('At least one checklist is required');
      return false;
    }
    if (_selectedReasons.isEmpty) {
      _showSnackBar('At least one reason is required');
      return false;
    }
    return true;
  }

  void _submitVisit() async {
    if (_isLoading || !_formKey.currentState!.validate() || !_validateInputs())
      return;
    setState(() => _isLoading = true);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final timesheetProvider = Provider.of<TimesheetProvider>(
      context,
      listen: false,
    );
    final locationProvider = Provider.of<LocationProvider>(
      context,
      listen: false,
    );

    try {
      final region = _regions.firstWhere(
        (r) => r['regionID'] == _selectedRegionId,
        orElse: () => null,
      );
      await locationProvider.getGovernoratesByRegion(_selectedRegionId!);
      final governorate = locationProvider.governorates.firstWhere(
        (g) => g['governorateID'] == _selectedGovernorateId,
        orElse: () => null,
      );
      await locationProvider.getDelegationsByGovernorate(
        _selectedGovernorateId!,
      );
      final delegation = locationProvider.delegations.firstWhere(
        (d) => d['delegationID'] == _selectedDelegationId,
        orElse: () => null,
      );
      final location = [
        region?['name'],
        governorate?['name'],
        delegation?['name'],
      ].where((e) => e != null).join(', ');

      final checklistUpdates =
          _selectedChecklists.map((c) => {'id': c.checklistID}).toList();
      final reasonUpdates =
          _selectedReasons.map((r) => {'id': r.reasonID}).toList();

      final visit = {
        'date': _selectedDate!.toIso8601String().split('T')[0],
        'time': _selectedTime!
            .format(context)
            .toLowerCase()
            .replaceAll(' ', ''),
        'agentID': _selectedAgentId!,
        'location': location,
        'reasons': reasonUpdates,
        'checklists': checklistUpdates,
      };

      await timesheetProvider.createTimesheetForSupervisor(
        weekNumber: _getWeekNumber(_selectedDate!),
        year: _selectedDate!.year,
        supervisorID: authProvider.user!.userID,
        visits: [visit],
        status: 'pending',
      );

      Navigator.pop(context);
      _showSnackBar('Visit created successfully');
    } catch (e) {
      _showSnackBar('Failed to create visit: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showSnackBar(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor:
              message.contains('successfully')
                  ? Theme.of(context).colorScheme.primary
                  : Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CustomAppBar(title: 'Create Visit', showBackButton: true),
      drawer: const AppSidebar(),
      body: Container(
        color: Theme.of(context).scaffoldBackgroundColor,
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child:
              _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : Form(
                    key: _formKey,
                    child: ListView(
                      children: [
                        _buildSectionCard(
                          title: 'Date & Time',
                          child: Column(
                            children: [
                              _buildTile(
                                icon: Icons.calendar_today,
                                title:
                                    _selectedDate == null
                                        ? 'Select Date'
                                        : '${_selectedDate!.day}/${_selectedDate!.month}/${_selectedDate!.year}',
                                onTap: () => _selectDate(context),
                              ),
                              const CustomSpacer(height: 12),
                              _buildTile(
                                icon: Icons.access_time,
                                title:
                                    _selectedTime == null
                                        ? 'Select Time'
                                        : _selectedTime!.format(context),
                                onTap: () => _selectTime(context),
                              ),
                            ],
                          ),
                        ),
                        const CustomSpacer(height: 16),
                        _buildSectionCard(
                          title: 'Location & Agent',
                          child: Consumer2<AgentProvider, LocationProvider>(
                            builder: (
                              context,
                              agentProvider,
                              locationProvider,
                              child,
                            ) {
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 0,
                                      horizontal: 16,
                                    ),
                                    decoration: BoxDecoration(
                                      color:
                                          Theme.of(context).colorScheme.surface,
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onSurface
                                            .withOpacity(0.2),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Icon(
                                          Icons.phone,
                                          color:
                                              Theme.of(
                                                context,
                                              ).colorScheme.primary,
                                          size: 24,
                                        ),
                                        const CustomSpacer(width: 12),
                                        Expanded(
                                          child: TextField(
                                            controller: _phoneController,
                                            keyboardType: TextInputType.number,
                                            inputFormatters: [
                                              FilteringTextInputFormatter
                                                  .digitsOnly,
                                            ],
                                            maxLength: 8,
                                            decoration: InputDecoration(
                                              hintText:
                                                  'Enter agent\'s phone number',
                                              border: InputBorder.none,
                                              hintStyle: TextStyle(
                                                color: Theme.of(context)
                                                    .colorScheme
                                                    .onSurface
                                                    .withOpacity(0.6),
                                              ),
                                              counterText: '',
                                            ),
                                            style: TextStyle(
                                              fontSize: 16,
                                              color:
                                                  Theme.of(
                                                    context,
                                                  ).colorScheme.onSurface,
                                            ),
                                            onChanged:
                                                (value) => _onPhoneChanged(
                                                  value,
                                                  agentProvider,
                                                ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  if (_phoneError != null) ...[
                                    const CustomSpacer(height: 8),
                                    Text(
                                      _phoneError!,
                                      style: TextStyle(
                                        color:
                                            Theme.of(context).colorScheme.error,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                  const CustomSpacer(height: 12),
                                  GestureDetector(
                                    onTap:
                                        _agentPhone.isNotEmpty
                                            ? null
                                            : () => _showLocationDialog(
                                              context,
                                              'region',
                                            ),
                                    child: Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color:
                                            Theme.of(
                                              context,
                                            ).colorScheme.surface,
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onSurface
                                              .withOpacity(0.2),
                                        ),
                                        backgroundBlendMode:
                                            _agentPhone.isNotEmpty
                                                ? BlendMode.saturation
                                                : null,
                                      ),
                                      child: Row(
                                        children: [
                                          Icon(
                                            Icons.location_on,
                                            color:
                                                _agentPhone.isNotEmpty
                                                    ? Theme.of(context)
                                                        .colorScheme
                                                        .onSurface
                                                        .withOpacity(0.6)
                                                    : Theme.of(
                                                      context,
                                                    ).colorScheme.primary,
                                          ),
                                          const CustomSpacer(width: 12),
                                          Expanded(
                                            child: Text(
                                              _selectedRegionId == null
                                                  ? 'Select Region'
                                                  : _regions.firstWhere(
                                                    (r) =>
                                                        r['regionID'] ==
                                                        _selectedRegionId,
                                                  )['name'],
                                              style: TextStyle(
                                                color:
                                                    _agentPhone.isNotEmpty
                                                        ? Theme.of(context)
                                                            .colorScheme
                                                            .onSurface
                                                            .withOpacity(0.6)
                                                        : Theme.of(
                                                          context,
                                                        ).colorScheme.onSurface,
                                              ),
                                            ),
                                          ),
                                          Icon(
                                            Icons.arrow_drop_down,
                                            color: Theme.of(context)
                                                .colorScheme
                                                .onSurface
                                                .withOpacity(0.6),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  const CustomSpacer(height: 12),
                                  GestureDetector(
                                    onTap:
                                        _agentPhone.isNotEmpty ||
                                                _selectedRegionId == null
                                            ? null
                                            : () => _showLocationDialog(
                                              context,
                                              'governorate',
                                            ),
                                    child: Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color:
                                            Theme.of(
                                              context,
                                            ).colorScheme.surface,
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onSurface
                                              .withOpacity(0.2),
                                        ),
                                        backgroundBlendMode:
                                            _agentPhone.isNotEmpty ||
                                                    _selectedRegionId == null
                                                ? BlendMode.saturation
                                                : null,
                                      ),
                                      child: Row(
                                        children: [
                                          Icon(
                                            Icons.location_city,
                                            color:
                                                _agentPhone.isNotEmpty ||
                                                        _selectedRegionId ==
                                                            null
                                                    ? Theme.of(context)
                                                        .colorScheme
                                                        .onSurface
                                                        .withOpacity(0.6)
                                                    : Theme.of(
                                                      context,
                                                    ).colorScheme.primary,
                                          ),
                                          const CustomSpacer(width: 12),
                                          Expanded(
                                            child: Text(
                                              _selectedGovernorateId == null
                                                  ? 'Select Governorate'
                                                  : locationProvider
                                                      .governorates
                                                      .firstWhere(
                                                        (g) =>
                                                            g['governorateID'] ==
                                                            _selectedGovernorateId,
                                                        orElse:
                                                            () => {
                                                              'name': 'Unknown',
                                                            },
                                                      )['name'],
                                              style: TextStyle(
                                                color:
                                                    _agentPhone.isNotEmpty ||
                                                            _selectedRegionId ==
                                                                null
                                                        ? Theme.of(context)
                                                            .colorScheme
                                                            .onSurface
                                                            .withOpacity(0.6)
                                                        : Theme.of(
                                                          context,
                                                        ).colorScheme.onSurface,
                                              ),
                                            ),
                                          ),
                                          Icon(
                                            Icons.arrow_drop_down,
                                            color: Theme.of(context)
                                                .colorScheme
                                                .onSurface
                                                .withOpacity(0.6),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  const CustomSpacer(height: 12),
                                  GestureDetector(
                                    onTap:
                                        _agentPhone.isNotEmpty ||
                                                _selectedGovernorateId == null
                                            ? null
                                            : () => _showLocationDialog(
                                              context,
                                              'delegation',
                                            ),
                                    child: Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color:
                                            Theme.of(
                                              context,
                                            ).colorScheme.surface,
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onSurface
                                              .withOpacity(0.2),
                                        ),
                                        backgroundBlendMode:
                                            _agentPhone.isNotEmpty ||
                                                    _selectedGovernorateId ==
                                                        null
                                                ? BlendMode.saturation
                                                : null,
                                      ),
                                      child: Row(
                                        children: [
                                          Icon(
                                            Icons.place,
                                            color:
                                                _agentPhone.isNotEmpty ||
                                                        _selectedGovernorateId ==
                                                            null
                                                    ? Theme.of(context)
                                                        .colorScheme
                                                        .onSurface
                                                        .withOpacity(0.6)
                                                    : Theme.of(
                                                      context,
                                                    ).colorScheme.primary,
                                          ),
                                          const CustomSpacer(width: 12),
                                          Expanded(
                                            child: Text(
                                              _selectedDelegationId == null
                                                  ? 'Select Delegation'
                                                  : locationProvider.delegations
                                                      .firstWhere(
                                                        (d) =>
                                                            d['delegationID'] ==
                                                            _selectedDelegationId,
                                                        orElse:
                                                            () => {
                                                              'name': 'Unknown',
                                                            },
                                                      )['name'],
                                              style: TextStyle(
                                                color:
                                                    _agentPhone.isNotEmpty ||
                                                            _selectedGovernorateId ==
                                                                null
                                                        ? Theme.of(context)
                                                            .colorScheme
                                                            .onSurface
                                                            .withOpacity(0.6)
                                                        : Theme.of(
                                                          context,
                                                        ).colorScheme.onSurface,
                                              ),
                                            ),
                                          ),
                                          Icon(
                                            Icons.arrow_drop_down,
                                            color: Theme.of(context)
                                                .colorScheme
                                                .onSurface
                                                .withOpacity(0.6),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  const CustomSpacer(height: 12),
                                  GestureDetector(
                                    onTap:
                                        _agentPhone.isNotEmpty ||
                                                _selectedDelegationId == null
                                            ? null
                                            : () => _showAgentDialog(
                                              context,
                                              agentProvider,
                                            ),
                                    child: Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color:
                                            Theme.of(
                                              context,
                                            ).colorScheme.surface,
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onSurface
                                              .withOpacity(0.2),
                                        ),
                                        backgroundBlendMode:
                                            _agentPhone.isNotEmpty ||
                                                    _selectedDelegationId ==
                                                        null
                                                ? BlendMode.saturation
                                                : null,
                                      ),
                                      child: Row(
                                        children: [
                                          Icon(
                                            Icons.person,
                                            color:
                                                _agentPhone.isNotEmpty ||
                                                        _selectedDelegationId ==
                                                            null
                                                    ? Theme.of(context)
                                                        .colorScheme
                                                        .onSurface
                                                        .withOpacity(0.6)
                                                    : Theme.of(
                                                      context,
                                                    ).colorScheme.primary,
                                          ),
                                          const CustomSpacer(width: 12),
                                          Expanded(
                                            child: Text(
                                              _selectedAgentId == null
                                                  ? (_agentPhone.isNotEmpty
                                                      ? 'Selected via phone'
                                                      : _selectedDelegationId ==
                                                          null
                                                      ? 'Select a delegation first'
                                                      : 'Select Agent')
                                                  : '${agentProvider.agents.firstWhere((agent) => agent.agentID == _selectedAgentId, orElse: () => Agent(agentID: '', name: 'Unknown', lastname: '', delegationID: '')).name} ${agentProvider.agents.firstWhere((agent) => agent.agentID == _selectedAgentId, orElse: () => Agent(agentID: '', name: '', lastname: 'Unknown', delegationID: '')).lastname}',
                                              style: TextStyle(
                                                color:
                                                    _agentPhone.isNotEmpty ||
                                                            _selectedDelegationId ==
                                                                null
                                                        ? Theme.of(context)
                                                            .colorScheme
                                                            .onSurface
                                                            .withOpacity(0.6)
                                                        : Theme.of(
                                                          context,
                                                        ).colorScheme.onSurface,
                                              ),
                                            ),
                                          ),
                                          Icon(
                                            Icons.arrow_drop_down,
                                            color: Theme.of(context)
                                                .colorScheme
                                                .onSurface
                                                .withOpacity(0.6),
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
                        const CustomSpacer(height: 16),
                        _buildSectionCard(
                          title: 'Checklists',
                          child: Consumer<ChecklistProvider>(
                            builder: (context, checklistProvider, child) {
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  GestureDetector(
                                    onTap:
                                        () => _showChecklistDialog(
                                          context,
                                          checklistProvider,
                                        ),
                                    child: Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color:
                                            Theme.of(
                                              context,
                                            ).colorScheme.surface,
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onSurface
                                              .withOpacity(0.2),
                                        ),
                                      ),
                                      child: Row(
                                        children: [
                                          Icon(
                                            Icons.checklist,
                                            color:
                                                Theme.of(
                                                  context,
                                                ).colorScheme.primary,
                                          ),
                                          const CustomSpacer(width: 12),
                                          Expanded(
                                            child: Text(
                                              _selectedChecklists.isEmpty
                                                  ? 'Select Checklists'
                                                  : '${_selectedChecklists.length} selected',
                                              style:
                                                  Theme.of(
                                                    context,
                                                  ).textTheme.bodyMedium,
                                            ),
                                          ),
                                          Icon(
                                            Icons.arrow_drop_down,
                                            color: Theme.of(context)
                                                .colorScheme
                                                .onSurface
                                                .withOpacity(0.6),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  if (_selectedChecklists.isNotEmpty) ...[
                                    const CustomSpacer(height: 8),
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 8,
                                      children:
                                          _selectedChecklists
                                              .map(
                                                (checklist) => Chip(
                                                  label: Text(checklist.item),
                                                  deleteIcon: const Icon(
                                                    Icons.close,
                                                    size: 18,
                                                  ),
                                                  onDeleted:
                                                      () => setState(
                                                        () =>
                                                            _selectedChecklists
                                                                .remove(
                                                                  checklist,
                                                                ),
                                                      ),
                                                  backgroundColor: Theme.of(
                                                        context,
                                                      ).colorScheme.primary
                                                      .withOpacity(0.1),
                                                  labelStyle: TextStyle(
                                                    color:
                                                        Theme.of(
                                                          context,
                                                        ).colorScheme.primary,
                                                  ),
                                                ),
                                              )
                                              .toList(),
                                    ),
                                  ],
                                ],
                              );
                            },
                          ),
                        ),
                        const CustomSpacer(height: 16),
                        _buildSectionCard(
                          title: 'Reasons',
                          child: Consumer<ReasonProvider>(
                            builder: (context, reasonProvider, child) {
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  GestureDetector(
                                    onTap:
                                        () => _showReasonDialog(
                                          context,
                                          reasonProvider,
                                        ),
                                    child: Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color:
                                            Theme.of(
                                              context,
                                            ).colorScheme.surface,
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onSurface
                                              .withOpacity(0.2),
                                        ),
                                      ),
                                      child: Row(
                                        children: [
                                          Icon(
                                            Icons.list_alt,
                                            color:
                                                Theme.of(
                                                  context,
                                                ).colorScheme.primary,
                                          ),
                                          const CustomSpacer(width: 12),
                                          Expanded(
                                            child: Text(
                                              _selectedReasons.isEmpty
                                                  ? 'Select Reasons'
                                                  : '${_selectedReasons.length} selected',
                                              style:
                                                  Theme.of(
                                                    context,
                                                  ).textTheme.bodyMedium,
                                            ),
                                          ),
                                          Icon(
                                            Icons.arrow_drop_down,
                                            color: Theme.of(context)
                                                .colorScheme
                                                .onSurface
                                                .withOpacity(0.6),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  if (_selectedReasons.isNotEmpty) ...[
                                    const CustomSpacer(height: 8),
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 8,
                                      children:
                                          _selectedReasons
                                              .map(
                                                (reason) => Chip(
                                                  label: Text(reason.item),
                                                  deleteIcon: const Icon(
                                                    Icons.close,
                                                    size: 18,
                                                  ),
                                                  onDeleted:
                                                      () => setState(
                                                        () => _selectedReasons
                                                            .remove(reason),
                                                      ),
                                                  backgroundColor: Theme.of(
                                                        context,
                                                      ).colorScheme.primary
                                                      .withOpacity(0.1),
                                                  labelStyle: TextStyle(
                                                    color:
                                                        Theme.of(
                                                          context,
                                                        ).colorScheme.primary,
                                                  ),
                                                ),
                                              )
                                              .toList(),
                                    ),
                                  ],
                                ],
                              );
                            },
                          ),
                        ),
                        const CustomSpacer(height: 24),
                        CustomButton(
                          label: 'Create Visit',
                          onPressed: _submitVisit,
                          isLoading: _isLoading,
                        ),
                      ],
                    ),
                  ),
        ),
      ),
    );
  }

  Widget _buildSectionCard({required String title, required Widget child}) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: child,
          ),
        ],
      ),
    );
  }

  Widget _buildTile({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2),
          ),
        ),
        child: Row(
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary),
            const CustomSpacer(width: 12),
            Expanded(
              child: Text(title, style: Theme.of(context).textTheme.bodyMedium),
            ),
            Icon(
              Icons.arrow_drop_down,
              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
            ),
          ],
        ),
      ),
    );
  }
}
