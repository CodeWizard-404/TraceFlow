import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../../models/visit.dart';
import '../../models/checklist.dart';
import '../../models/reason.dart';
import '../../models/agent.dart';
import '../../models/visit_checklist.dart';
import '../../providers/auth_provider.dart';
import '../../providers/visit_provider.dart';
import '../../providers/agent_provider.dart';
import '../../providers/checklist_provider.dart';
import '../../providers/reason_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/user_provider.dart';
import '../../services/location_service.dart';
import '../../utils/constants.dart';
import '../../widgets/appbar/app_bar.dart';
import '../../widgets/appbar/sidebar.dart';
import '../../widgets/commen/button.dart';
import '../../widgets/commen/snack_bar.dar.dart';
import '../../widgets/commen/spacer.dart';

class EditVisitScreen extends StatefulWidget {
  final Visit visit;

  const EditVisitScreen({super.key, required this.visit});

  @override
  State<EditVisitScreen> createState() => _EditVisitScreenState();
}

class _EditVisitScreenState extends State<EditVisitScreen> {
  final _formKey = GlobalKey<FormState>();
  late Visit _visit;
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
  final TextEditingController _commentController = TextEditingController();
  bool _isLoading = false;
  bool _isInitialized = false;
  List<dynamic> _regions = [];
  bool _isRecruitmentVisit = false;
  Map<String, dynamic>? _selectedGovernorate;
  Map<String, dynamic>? _selectedDelegation;
  DateTime? _editStartTime;
  bool _hasChanges = false;
  List<String> _photosToRemove = [];
  List<File> _newPhotos = [];

  @override
  void initState() {
    super.initState();
    _visit = widget.visit;
    _selectedDate = _visit.date;
    _selectedTime = TimeOfDay.fromDateTime(DateFormat('HH:mm').parse(_visit.time));
    _selectedAgentId = _visit.agentID;
    _selectedChecklists = List.from(_visit.checklists ?? []);
    _selectedReasons = List.from(_visit.reasons ?? []);
    _isRecruitmentVisit = _visit.agentID == null;
    _commentController.text = _visit.comment ?? '';
    if (_visit.agentID != null) {
      _agentPhone = ''; // Will be set in _loadInitialData
    }

    _phoneController.addListener(_checkForChanges);
    _commentController.addListener(_checkForChanges);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_isInitialized) _loadInitialData();
      if (_visit.status == 'visited') _startEditTimer();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _phoneController.dispose();
    _commentController.dispose();
    super.dispose();
  }

  void _startEditTimer() {
    _editStartTime = DateTime.now();
  }

  void _checkForChanges() {
    setState(() {
      _hasChanges =
          _selectedDate != _visit.date ||
              _selectedTime?.format(context) != _visit.time ||
              _selectedAgentId != _visit.agentID ||
              _selectedChecklists.length != (_visit.checklists?.length ?? 0) ||
              _selectedReasons.length != (_visit.reasons?.length ?? 0) ||
              _phoneController.text != _agentPhone ||
              _commentController.text != (_visit.comment ?? '') ||
              _isRecruitmentVisit != (_visit.agentID == null) ||
              _photosToRemove.isNotEmpty ||
              _newPhotos.isNotEmpty ||
              _visitChecklists.any(
                    (c) =>
                c.visitChecklist?.checked !=
                    (_visit.checklists
                        ?.firstWhere(
                          (vc) => vc.checklistID == c.checklistID,
                      orElse: () => Checklist(checklistID: c.checklistID, item: c.item),
                    )
                        .visitChecklist
                        ?.checked ??
                        false),
              );
    });
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      final locationProvider = Provider.of<LocationProvider>(context, listen: false);
      final checklistProvider = Provider.of<ChecklistProvider>(context, listen: false);
      final reasonProvider = Provider.of<ReasonProvider>(context, listen: false);
      final agentProvider = Provider.of<AgentProvider>(context, listen: false);

      final supervisorID = authProvider.user!.userID;
      final regionalManager = await userProvider.getRegionalManagerBySupervisor(supervisorID);
      final regionalManagerID = regionalManager.userID;

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

      if (_visit.location != null) {
        final parts = _visit.location!.split(', ');
        if (parts.length == 3) {
          _selectedRegionId = _regions.firstWhere((r) => r['name'] == parts[0])['regionID'];
          await locationProvider.getGovernoratesByRegion(_selectedRegionId!);
          _selectedGovernorateId = locationProvider.governorates.firstWhere((g) => g['name'] == parts[1])['governorateID'];
          await locationProvider.getDelegationsByGovernorate(_selectedGovernorateId!);
          _selectedDelegationId = locationProvider.delegations.firstWhere((d) => d['name'] == parts[2])['delegationID'];
        }
      }

      if (_selectedAgentId != null) {
        await agentProvider.fetchAgentById(_selectedAgentId!);
        _agentPhone = agentProvider.currentAgent?.phone ?? '';
        _phoneController.text = _agentPhone;
      }

      _isInitialized = true;
    } catch (e) {
      _showSnackBar('Failed to load initial data: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _selectDate(BuildContext context) async {
    if (_visit.status == 'visited') return;
    final now = DateTime.now();
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
      builder: (context, child) => Theme(
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
        _checkForChanges();
      });
    }
  }

  Future<void> _selectTime(BuildContext context) async {
    if (_visit.status == 'visited') return;
    final now = DateTime.now();
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: _selectedTime ?? TimeOfDay.now(),
      builder: (context, child) => Theme(
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
        _checkForChanges();
      });
    }
  }

  Future<void> _showLocationDialog(BuildContext context, String type) async {
    if (_visit.status == 'visited') return;
    final locationProvider = Provider.of<LocationProvider>(context, listen: false);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    List<dynamic> items;
    String? selectedValue;

    switch (type) {
      case 'region':
        items = _regions;
        selectedValue = _selectedRegionId;
        break;
      case 'governorate':
        final regionGovs = await LocationService.getGovernoratesByRegion(_selectedRegionId!);
        final supervisorGovs = await LocationService.getGovernoratesByUser(authProvider.user!.userID);
        items = regionGovs.where((g) => supervisorGovs.any((sg) => sg['governorateID'] == g['governorateID'])).toList();
        selectedValue = _selectedGovernorateId;
        break;
      case 'delegation':
        final govDels = await LocationService.getDelegationsByGovernorate(_selectedGovernorateId!);
        final supervisorDels = await LocationService.getDelegationsByUser(authProvider.user!.userID);
        items = govDels.where((d) => supervisorDels.any((sd) => sd['delegationID'] == d['delegationID'])).toList();
        selectedValue = _selectedDelegationId;
        break;
      default:
        return;
    }

    final TextEditingController searchController = TextEditingController();
    List<dynamic> filteredItems = List.from(items);

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: Theme.of(context).cardTheme.color,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          title: Text(
            'Select $type',
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
                    hintText: 'Search ${type}s...',
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
                      filteredItems = items.where((item) => item['name'].toLowerCase().contains(value.toLowerCase())).toList();
                    });
                  },
                ),
                const CustomSpacer(height: 8),
                SizedBox(
                  height: 300,
                  child: ListView.builder(
                    itemCount: filteredItems.length,
                    itemBuilder: (context, index) {
                      final item = filteredItems[index];
                      return ListTile(
                        leading: Icon(
                          Icons.location_on_outlined,
                          color: Theme.of(context).colorScheme.primary,
                          size: 18,
                        ),
                        title: Text(
                          item['name'],
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context).colorScheme.onSurface,
                          ),
                        ),
                        trailing: selectedValue == item['${type}ID']
                            ? Icon(
                          Icons.check_circle,
                          color: Theme.of(context).colorScheme.primary,
                          size: 18,
                        )
                            : null,
                        onTap: () {
                          setState(() {
                            if (type == 'region') {
                              _selectedRegionId = item['${type}ID'];
                              _selectedGovernorateId = null;
                              _selectedGovernorate = null;
                              _selectedDelegationId = null;
                              _selectedDelegation = null;
                            } else if (type == 'governorate') {
                              _selectedGovernorate = item;
                              _selectedGovernorateId = item['${type}ID'];
                              _selectedDelegationId = null;
                              _selectedDelegation = null;
                            } else {
                              _selectedDelegation = item;
                              _selectedDelegationId = item['${type}ID'];
                            }
                            if (!_isRecruitmentVisit) {
                              _selectedAgentId = null;
                              _phoneController.clear();
                              _agentPhone = '';
                              _phoneError = null;
                            }
                            _checkForChanges();
                          });
                          Navigator.pop(context);
                        },
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
          ],
        ),
      ),
    );
  }

  Future<void> _showAgentDialog(BuildContext context, AgentProvider agentProvider) async {
    if (_visit.status == 'visited') return;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    setState(() => _isLoading = true);

    try {
      await agentProvider.getAgentsByUser(authProvider.user!.userID);
      final supervisorAgents = List<Agent>.from(agentProvider.agents);
      final delegationAgents = await agentProvider.fetchAgentsByDelegation(_selectedDelegationId!);
      final filteredAgents = supervisorAgents.where((a) => delegationAgents.any((da) => da.agentID == a.agentID)).toList();

      setState(() => _isLoading = false);

      final TextEditingController searchController = TextEditingController();
      List<Agent> filteredItems = List.from(filteredAgents);

      await showDialog<void>(
        context: context,
        builder: (BuildContext dialogBuilderContext) => StatefulBuilder(
          builder: (BuildContext dialogBuilderContext, StateSetter setDialogState) => AlertDialog(
            backgroundColor: Theme.of(dialogBuilderContext).cardTheme.color,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            title: Text(
              'Select Agent',
              style: Theme.of(dialogBuilderContext).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: Theme.of(dialogBuilderContext).colorScheme.primary,
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
                      hintText: 'Search agents...',
                      prefixIcon: Icon(
                        Icons.search,
                        color: Theme.of(dialogBuilderContext).colorScheme.primary,
                        size: 18,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(
                          color: Theme.of(dialogBuilderContext).colorScheme.primary,
                          width: 1.5,
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(
                          color: Theme.of(dialogBuilderContext).colorScheme.primary.withOpacity(0.7),
                          width: 1.5,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(
                          color: Theme.of(dialogBuilderContext).colorScheme.primary,
                          width: 2,
                        ),
                      ),
                    ),
                    onChanged: (value) {
                      setDialogState(() {
                        filteredItems = filteredAgents
                            .where((agent) =>
                        '${agent.name} ${agent.lastname}'.toLowerCase().contains(value.toLowerCase()) ||
                            agent.agentID.toLowerCase().contains(value.toLowerCase()))
                            .toList();
                      });
                    },
                  ),
                  const CustomSpacer(height: 8),
                  SizedBox(
                    height: 300,
                    child: filteredItems.isEmpty
                        ? Center(
                      child: Text(
                        'No agents available',
                        style: Theme.of(dialogBuilderContext).textTheme.bodyMedium?.copyWith(
                          color: Colors.grey,
                        ),
                      ),
                    )
                        : ListView.builder(
                      itemCount: filteredItems.length,
                      itemBuilder: (context, index) {
                        final agent = filteredItems[index];
                        return ListTile(
                          leading: Icon(
                            Icons.person_outline,
                            color: Theme.of(context).colorScheme.primary,
                            size: 18,
                          ),
                          title: Text(
                            '${agent.name} ${agent.lastname}',
                            style: Theme.of(dialogBuilderContext).textTheme.bodyMedium?.copyWith(
                              color: Theme.of(dialogBuilderContext).colorScheme.onSurface,
                            ),
                          ),
                          trailing: _selectedAgentId == agent.agentID
                              ? Icon(
                            Icons.check_circle,
                            color: Theme.of(context).colorScheme.primary,
                            size: 18,
                          )
                              : null,
                          onTap: () {
                            setState(() {
                              _selectedAgentId = agent.agentID;
                              _phoneController.text = agent.phone ?? '';
                              _agentPhone = agent.phone ?? '';
                              _checkForChanges();
                            });
                            Navigator.pop(dialogBuilderContext);
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogBuilderContext),
                child: Text(
                  'Cancel',
                  style: TextStyle(
                    color: Theme.of(dialogBuilderContext).colorScheme.onSurface.withOpacity(0.6),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        _showSnackBar('Failed to load agents: $e');
      }
    }
  }

  Future<void> _showChecklistDialog(BuildContext context, ChecklistProvider checklistProvider) async {
    if (_visit.status == 'visited') return;
    final allChecklists = checklistProvider.allChecklists;
    final selectedChecklists = List<Checklist>.from(_selectedChecklists);
    final TextEditingController searchController = TextEditingController();
    List<Checklist> filteredChecklists = List.from(allChecklists);

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: Theme.of(context).cardTheme.color,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          title: Text(
            'Select Checklists',
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
                    hintText: 'Search checklists...',
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
                      filteredChecklists = allChecklists.where((checklist) => checklist.item.toLowerCase().contains(value.toLowerCase())).toList();
                    });
                  },
                ),
                const CustomSpacer(height: 8),
                SizedBox(
                  height: 300,
                  child: ListView.builder(
                    itemCount: filteredChecklists.length,
                    itemBuilder: (context, index) {
                      final checklist = filteredChecklists[index];
                      final isSelected = selectedChecklists.any((c) => c.checklistID == checklist.checklistID);
                      return ListTile(
                        leading: Icon(
                          Icons.checklist,
                          color: Theme.of(context).colorScheme.primary,
                          size: 18,
                        ),
                        title: Text(
                          checklist.item,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context).colorScheme.onSurface,
                          ),
                        ),
                        trailing: Checkbox(
                          value: isSelected,
                          onChanged: (value) {
                            setDialogState(() {
                              if (value == true) {
                                selectedChecklists.add(checklist);
                              } else {
                                selectedChecklists.removeWhere((c) => c.checklistID == checklist.checklistID);
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
            CustomButton(
              label: 'Confirm',
              onPressed: () {
                setState(() {
                  _selectedChecklists = selectedChecklists;
                  _checkForChanges();
                });
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showReasonDialog(BuildContext context, ReasonProvider reasonProvider) async {
    if (_visit.status == 'visited') return;
    final allReasons = reasonProvider.allReasons;
    final selectedReasons = List<Reason>.from(_selectedReasons);
    final TextEditingController searchController = TextEditingController();
    List<Reason> filteredReasons = List.from(allReasons);

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: Theme.of(context).cardTheme.color,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          title: Text(
            'Select Reasons',
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
                    hintText: 'Search reasons...',
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
                      filteredReasons = allReasons.where((reason) => reason.item.toLowerCase().contains(value.toLowerCase())).toList();
                    });
                  },
                ),
                const CustomSpacer(height: 8),
                SizedBox(
                  height: 300,
                  child: ListView.builder(
                    itemCount: filteredReasons.length,
                    itemBuilder: (context, index) {
                      final reason = filteredReasons[index];
                      final isSelected = selectedReasons.any((r) => r.reasonID == reason.reasonID);
                      return ListTile(
                        leading: Icon(
                          Icons.list_alt_outlined,
                          color: Theme.of(context).colorScheme.primary,
                          size: 18,
                        ),
                        title: Text(
                          reason.item,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context).colorScheme.onSurface,
                          ),
                        ),
                        trailing: Checkbox(
                          value: isSelected,
                          onChanged: (value) {
                            setDialogState(() {
                              if (value == true) {
                                selectedReasons.add(reason);
                              } else {
                                selectedReasons.removeWhere((r) => r.reasonID == reason.reasonID);
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
            CustomButton(
              label: 'Confirm',
              onPressed: () {
                setState(() {
                  _selectedReasons = selectedReasons;
                  _checkForChanges();
                });
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _onPhoneChanged(String value, AgentProvider agentProvider) async {
    if (_visit.status == 'visited') return;
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
          _checkForChanges();
        });
      } else if (value.length >= 8) {
        setState(() => _isLoading = true);
        try {
          final agent = await agentProvider.fetchAgentByPhone(value);
          if (agent != null) {
            await agentProvider.getAgentsByUser(authProvider.user!.userID);
            final supervisorAgents = agentProvider.agents;
            if (supervisorAgents.any((a) => a.agentID == agent.agentID)) {
              setState(() {
                _selectedAgentId = agent.agentID;
                _selectedDelegationId = agent.delegationID;
                _phoneError = null;
              });
              final locationDetails = await LocationService.getLocationDetailsById(agent.delegationID);
              if (locationDetails['success'] == true && locationDetails.containsKey('address')) {
                setState(() {
                  _selectedRegionId = locationDetails['regionID'] as String?;
                  _selectedGovernorateId = locationDetails['governorateID'] as String?;
                  _checkForChanges();
                });
              } else {
                setState(() => _phoneError = 'Invalid location data for agent');
              }
            } else {
              setState(() {
                _phoneError = 'Agent not assigned to supervisor';
                _selectedAgentId = null;
                _selectedDelegationId = null;
                _checkForChanges();
              });
            }
          } else {
            setState(() {
              _phoneError = 'Agent not found';
              _selectedAgentId = null;
              _selectedDelegationId = null;
              _checkForChanges();
            });
          }
        } catch (e) {
          setState(() {
            _phoneError = 'Error fetching agent: $e';
            _selectedAgentId = null;
            _selectedDelegationId = null;
            _checkForChanges();
          });
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

    if (_visit.status != 'visited') {
      if (selectedDate.isBefore(DateTime(now.year, now.month, now.day))) {
        _showSnackBar('Date cannot be before today');
        return false;
      }
      if (selectedDate.day == now.day && selectedDateTime.isBefore(now)) {
        _showSnackBar('Time cannot be before now for today');
        return false;
      }
      if (!_isRecruitmentVisit && _selectedAgentId == null) {
        _showSnackBar('An agent must be selected');
        return false;
      }
      if (!_isRecruitmentVisit && _selectedDelegationId == null) {
        _showSnackBar('A delegation must be selected');
        return false;
      }
      if (_selectedReasons.isEmpty) {
        _showSnackBar('At least one reason is required');
        return false;
      }
    }
    if (_selectedChecklists.isEmpty) {
      _showSnackBar('At least one checklist is required');
      return false;
    }
    return true;
  }

  void _submitVisit() async {
    if (_isLoading || !_formKey.currentState!.validate() || !_validateInputs()) return;
    setState(() => _isLoading = true);
    final visitProvider = Provider.of<VisitProvider>(context, listen: false);
    final locationProvider = Provider.of<LocationProvider>(context, listen: false);

    try {
      String? location;
      if (_selectedRegionId != null && _selectedGovernorateId != null && _selectedDelegationId != null) {
        final region = _regions.firstWhere((r) => r['regionID'] == _selectedRegionId);
        await locationProvider.getGovernoratesByRegion(_selectedRegionId!);
        final governorate = locationProvider.governorates.firstWhere((g) => g['governorateID'] == _selectedGovernorateId);
        await locationProvider.getDelegationsByGovernorate(_selectedGovernorateId!);
        final delegation = locationProvider.delegations.firstWhere((d) => d['delegationID'] == _selectedDelegationId);
        location = '${region['name']}, ${governorate['name']}, ${delegation['name']}';
      } else {
        location = _visit.location;
      }

      final checklistUpdates = _selectedChecklists.map((c) => {'id': c.checklistID, 'checked': c.visitChecklist?.checked ?? false}).toList();
      final reasonUpdates = _selectedReasons.map((r) => {'id': r.reasonID}).toList();

      int? updatedDuration = _visit.duration;
      if (_visit.status == 'visited' && _editStartTime != null) {
        updatedDuration = (_visit.duration ?? 0) + DateTime.now().difference(_editStartTime!).inMinutes;
      }

      await visitProvider.updateVisit(
        visitId: _visit.visitID!,
        date: _selectedDate!.toIso8601String().split('T')[0],
        time: _selectedTime!.format(context).toLowerCase().replaceAll(' ', ''),
        location: location,
        agentID: _isRecruitmentVisit ? null : _selectedAgentId,
        checklists: checklistUpdates,
        reasons: _visit.status == 'visited' ? null : reasonUpdates,
        status: _visit.status == 'visited' ? 'visited' : 'pending',
        duration: updatedDuration,
        comment: _visit.status == 'visited' && _commentController.text.isNotEmpty ? _commentController.text : _visit.comment,
        photoPaths: _newPhotos.isNotEmpty ? _newPhotos.map((p) => p.path).toList() : null,
        photosToRemove: _photosToRemove.isNotEmpty ? _photosToRemove : null,
      );

      _showSnackBar('Visit updated successfully');
      Navigator.pop(context);
    } catch (e) {
      _showSnackBar('Failed to update visit: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showSnackBar(String message) {
    if (mounted) {
      CustomSnackBar.show(
        context: context,
        message: message,
        backgroundColor: message.contains('successfully')
            ? Theme.of(context).colorScheme.primary.withOpacity(0.9)
            : Theme.of(context).colorScheme.error.withOpacity(0.9),
      );
    }
  }

  void _handleRecruitmentVisitToggle(bool value) {
    if (_visit.status == 'visited') return;
    setState(() {
      _isRecruitmentVisit = value;
      if (value) {
        _selectedAgentId = null;
        _phoneController.clear();
        _agentPhone = '';
        _phoneError = null;
        final reasonProvider = Provider.of<ReasonProvider>(context, listen: false);
        final recruitmentReason = reasonProvider.allReasons.firstWhere(
              (r) => r.item.toLowerCase() == 'recruitment',
          orElse: () => Reason(reasonID: '', item: ''),
        );
        if (recruitmentReason.reasonID.isNotEmpty && !_selectedReasons.any((r) => r.reasonID == recruitmentReason.reasonID)) {
          _selectedReasons = [recruitmentReason];
        }
      }
      _checkForChanges();
    });
  }

  void _toggleChecklist(Checklist checklist, bool? value) {
    if (_visit.status != 'visited') return;
    setState(() {
      final index = _selectedChecklists.indexWhere((c) => c.checklistID == checklist.checklistID);
      if (index != -1) {
        _selectedChecklists[index] = Checklist(
          checklistID: checklist.checklistID,
          item: checklist.item,
          visitChecklist: VisitChecklist(
            checked: value ?? false,
            visitID: _visit.visitID,
            checklistID: checklist.checklistID,
          ),
        );
      }
      _checkForChanges();
    });
  }

  Future<void> _addNewPhoto() async {
    if (_visit.status != 'visited') return;
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.camera);
    if (pickedFile != null) {
      setState(() {
        _newPhotos.add(File(pickedFile.path));
        _checkForChanges();
      });
    }
  }

  void _removePhoto(String photo) {
    if (_visit.status != 'visited') return;
    setState(() {
      _photosToRemove.add(photo);
      _checkForChanges();
    });
  }

  void _viewPhotoFullScreen(String photoPath) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => Scaffold(
          appBar: CustomAppBar(title: 'Photo View', showBackButton: true),
          body: Center(
            child: Image.network(
              photoPath.startsWith('http') ? photoPath : '$baseUrl$photoPath',
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) => const Icon(
                Icons.error,
                color: Colors.white,
                size: 50,
              ),
            ),
          ),
          backgroundColor: Colors.black,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(_visit.status == 'visited' ? 'Review Visit' : 'Edit Visit'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      drawer: const AppSidebar(),
      body: _isLoading && !_isInitialized
          ? const Center(child: CircularProgressIndicator())
          : Padding(
        padding: const EdgeInsets.all(8.0),
        child: Column(
          children: [
            Expanded(
              child: Form(
                key: _formKey,
                child: ListView(
                  children: [
                    if (_visit.status != 'visited') ...[
                      _buildSectionCard(
                        context,
                        title: 'Date & Time',
                        children: [
                          _buildSelector(
                            context: context,
                            label: 'Date',
                            value: _selectedDate == null
                                ? 'Select Date'
                                : '${_selectedDate!.day}/${_selectedDate!.month}/${_selectedDate!.year}',
                            icon: Icons.calendar_today_outlined,
                            onTap: () => _selectDate(context),
                          ),
                          _buildSelector(
                            context: context,
                            label: 'Time',
                            value: _selectedTime == null
                                ? 'Select Time'
                                : _selectedTime!.format(context),
                            icon: Icons.access_time_outlined,
                            onTap: () => _selectTime(context),
                          ),
                        ],
                      ),
                      const CustomSpacer(height: 8),
                      _buildSectionCard(
                        context,
                        title: 'Visit Type',
                        children: [
                          CheckboxListTile(
                            title: Text(
                              'Recruitment Visit',
                              style: theme.textTheme.bodyMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: theme.colorScheme.onSurface,
                              ),
                            ),
                            value: _isRecruitmentVisit,
                            onChanged: (value) => _handleRecruitmentVisitToggle(value ?? false),
                            activeColor: theme.colorScheme.primary,
                          ),
                        ],
                      ),
                      const CustomSpacer(height: 8),
                      _buildSectionCard(
                        context,
                        title: 'Location & Agent',
                        children: [
                          Consumer2<AgentProvider, LocationProvider>(
                            builder: (context, agentProvider, locationProvider, child) {
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _buildSelector(
                                    context: context,
                                    label: 'Region',
                                    value: _selectedRegionId == null
                                        ? 'Select Region'
                                        : _regions.firstWhere((r) => r['regionID'] == _selectedRegionId)['name'],
                                    icon: Icons.location_on_outlined,
                                    onTap: () => _showLocationDialog(context, 'region'),
                                  ),
                                  _buildSelector(
                                    context: context,
                                    label: 'Governorate',
                                    value: _selectedGovernorate == null
                                        ? 'Select Governorate'
                                        : _selectedGovernorate!['name'],
                                    icon: Icons.location_city_outlined,
                                    onTap: _selectedRegionId == null
                                        ? null
                                        : () => _showLocationDialog(context, 'governorate'),
                                    disabled: _selectedRegionId == null,
                                  ),
                                  _buildSelector(
                                    context: context,
                                    label: 'Delegation',
                                    value: _selectedDelegation == null
                                        ? 'Select Delegation'
                                        : _selectedDelegation!['name'],
                                    icon: Icons.place_outlined,
                                    onTap: _selectedGovernorateId == null
                                        ? null
                                        : () => _showLocationDialog(context, 'delegation'),
                                    disabled: _selectedGovernorateId == null,
                                  ),
                                  if (!_isRecruitmentVisit) ...[
                                    Padding(
                                      padding: const EdgeInsets.symmetric(vertical: 4),
                                      child: TextField(
                                        controller: _phoneController,
                                        keyboardType: TextInputType.number,
                                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                        maxLength: 8,
                                        decoration: InputDecoration(
                                          filled: true,
                                          fillColor: theme.colorScheme.background,
                                          hintText: "Enter agent's phone number",
                                          prefixIcon: Icon(
                                            Icons.phone_outlined,
                                            color: theme.colorScheme.primary,
                                            size: 18,
                                          ),
                                          border: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(8),
                                            borderSide: BorderSide(
                                              color: theme.colorScheme.primary,
                                              width: 1.5,
                                            ),
                                          ),
                                          enabledBorder: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(8),
                                            borderSide: BorderSide(
                                              color: theme.colorScheme.primary.withOpacity(0.7),
                                              width: 1.5,
                                            ),
                                          ),
                                          focusedBorder: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(8),
                                            borderSide: BorderSide(
                                              color: theme.colorScheme.primary,
                                              width: 2,
                                            ),
                                          ),
                                          counterText: '',
                                          hintStyle: TextStyle(
                                            color: theme.colorScheme.onSurface.withOpacity(0.6),
                                          ),
                                        ),
                                        style: TextStyle(
                                          fontSize: 16,
                                          color: theme.colorScheme.onSurface,
                                        ),
                                        onChanged: (value) => _onPhoneChanged(value, agentProvider),
                                      ),
                                    ),
                                    if (_phoneError != null) ...[
                                      Padding(
                                        padding: const EdgeInsets.only(left: 8),
                                        child: Text(
                                          _phoneError!,
                                          style: TextStyle(
                                            color: theme.colorScheme.error,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ),
                                    ],
                                    _buildSelector(
                                      context: context,
                                      label: 'Agent',
                                      value: _selectedAgentId == null
                                          ? (_agentPhone.isNotEmpty
                                          ? 'Selected via phone'
                                          : _selectedDelegationId == null
                                          ? 'Select a delegation first'
                                          : 'Select Agent')
                                          : '${agentProvider.agents.firstWhere((agent) => agent.agentID == _selectedAgentId, orElse: () => Agent(agentID: '', name: 'Unknown', lastname: '', delegationID: '')).name} ${agentProvider.agents.firstWhere((agent) => agent.agentID == _selectedAgentId, orElse: () => Agent(agentID: '', name: '', lastname: 'Unknown', delegationID: '')).lastname}',
                                      icon: Icons.person_outline,
                                      onTap: _agentPhone.isNotEmpty || _selectedDelegationId == null
                                          ? null
                                          : () => _showAgentDialog(context, agentProvider),
                                      disabled: _agentPhone.isNotEmpty || _selectedDelegationId == null,
                                    ),
                                  ],
                                ],
                              );
                            },
                          ),
                        ],
                      ),
                      const CustomSpacer(height: 8),
                      _buildSectionCard(
                        context,
                        title: 'Checklists',
                        children: [
                          Consumer<ChecklistProvider>(
                            builder: (context, checklistProvider, child) {
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _buildSelector(
                                    context: context,
                                    label: 'Checklists',
                                    value: _selectedChecklists.isEmpty
                                        ? 'Select Checklists'
                                        : '${_selectedChecklists.length} selected',
                                    icon: Icons.checklist,
                                    onTap: () => _showChecklistDialog(context, checklistProvider),
                                  ),
                                  if (_selectedChecklists.isNotEmpty) ...[
                                    const CustomSpacer(height: 4),
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 4,
                                      children: _selectedChecklists
                                          .map(
                                            (checklist) => Chip(
                                          label: Text(
                                            checklist.item,
                                            style: theme.textTheme.bodyMedium?.copyWith(
                                              color: theme.colorScheme.onSurface.withOpacity(0.9),
                                            ),
                                          ),
                                          deleteIcon: Icon(
                                            Icons.close,
                                            size: 16,
                                            color: theme.colorScheme.onSurface.withOpacity(0.6),
                                          ),
                                          onDeleted: () => setState(() {
                                            _selectedChecklists.remove(checklist);
                                            _checkForChanges();
                                          }),
                                          backgroundColor: theme.colorScheme.primary.withOpacity(0.15),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(4),
                                            side: BorderSide(
                                              color: theme.colorScheme.primary.withOpacity(0.6),
                                              width: 1,
                                            ),
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
                        ],
                      ),
                      const CustomSpacer(height: 8),
                      _buildSectionCard(
                        context,
                        title: 'Reasons',
                        children: [
                          Consumer<ReasonProvider>(
                            builder: (context, reasonProvider, child) {
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _buildSelector(
                                    context: context,
                                    label: 'Reasons',
                                    value: _selectedReasons.isEmpty
                                        ? 'Select Reasons'
                                        : '${_selectedReasons.length} selected',
                                    icon: Icons.list_alt_outlined,
                                    onTap: () => _showReasonDialog(context, reasonProvider),
                                  ),
                                  if (_selectedReasons.isNotEmpty) ...[
                                    const CustomSpacer(height: 4),
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 4,
                                      children: _selectedReasons
                                          .map(
                                            (reason) => Chip(
                                          label: Text(
                                            reason.item,
                                            style: theme.textTheme.bodyMedium?.copyWith(
                                              color: theme.colorScheme.onSurface.withOpacity(0.9),
                                            ),
                                          ),
                                          deleteIcon: Icon(
                                            Icons.close,
                                            size: 16,
                                            color: theme.colorScheme.onSurface.withOpacity(0.6),
                                          ),
                                          onDeleted: () => setState(() {
                                            _selectedReasons.remove(reason);
                                            _checkForChanges();
                                          }),
                                          backgroundColor: theme.colorScheme.primary.withOpacity(0.15),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(4),
                                            side: BorderSide(
                                              color: theme.colorScheme.primary.withOpacity(0.6),
                                              width: 1,
                                            ),
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
                        ],
                      ),
                    ] else ...[
                      if (_visit.comment != null && _visit.comment!.isNotEmpty) ...[
                        _buildSectionCard(
                          context,
                          title: 'Details',
                          children: [
                            TextField(
                              controller: _commentController,
                              decoration: InputDecoration(
                                hintText: 'Enter comment',
                                prefixIcon: Icon(
                                  Icons.comment,
                                  color: theme.colorScheme.primary,
                                ),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const CustomSpacer(height: 8),
                      ],
                      _buildSectionCard(
                        context,
                        title: 'Checklists',
                        children: [
                          Consumer<ChecklistProvider>(
                            builder: (context, checklistProvider, child) {
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (_selectedChecklists.isNotEmpty)
                                    Column(
                                      children: _selectedChecklists
                                          .map(
                                            (checklist) => CheckboxListTile(
                                          title: Text(checklist.item),
                                          value: checklist.visitChecklist?.checked ?? false,
                                          onChanged: (value) => _toggleChecklist(checklist, value),
                                          activeColor: theme.colorScheme.primary,
                                          enabled: _visit.status == 'visited',
                                          controlAffinity: ListTileControlAffinity.leading,
                                          dense: true,
                                        ),
                                      )
                                          .toList(),
                                    ),
                                ],
                              );
                            },
                          ),
                        ],
                      ),
                      const CustomSpacer(height: 8),
                      _buildSectionCard(
                        context,
                        title: 'Reasons',
                        children: [
                          Consumer<ReasonProvider>(
                            builder: (context, reasonProvider, child) {
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (_selectedReasons.isNotEmpty) ...[
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 8,
                                      children: _selectedReasons
                                          .map(
                                            (reason) => Chip(
                                          label: Text(
                                            reason.item,
                                            style: theme.textTheme.bodyMedium?.copyWith(
                                              color: theme.colorScheme.onSurface.withOpacity(0.9),
                                            ),
                                          ),
                                          backgroundColor: theme.colorScheme.primary.withOpacity(0.15),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(4),
                                            side: BorderSide(
                                              color: theme.colorScheme.primary.withOpacity(0.6),
                                              width: 1,
                                            ),
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
                        ],
                      ),
                      if (_visit.photos != null && _visit.photos!.isNotEmpty || _newPhotos.isNotEmpty) ...[
                        const CustomSpacer(height: 8),
                        _buildSectionCard(
                          context,
                          title: 'Photos',
                          children: [
                            if (_visit.status == 'visited')
                              CustomButton(
                                label: 'Add Photo',
                                onPressed: _addNewPhoto,
                                backgroundColor: theme.colorScheme.primary.withOpacity(0.8),
                                textColor: Colors.white,
                                isOutlined: true,
                              ),
                            const CustomSpacer(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                if (_visit.photos != null)
                                  ..._visit.photos!
                                      .where((p) => !_photosToRemove.contains(p))
                                      .map(
                                        (photo) => GestureDetector(
                                      onTap: () => _viewPhotoFullScreen(photo),
                                      child: Stack(
                                        children: [
                                          Image.network(
                                            photo.startsWith('http') ? photo : '$baseUrl$photo',
                                            width: 100,
                                            height: 100,
                                            fit: BoxFit.cover,
                                            errorBuilder: (_, __, ___) => const Icon(
                                              Icons.error,
                                              size: 100,
                                            ),
                                          ),
                                          Positioned(
                                            top: 0,
                                            right: 0,
                                            child: IconButton(
                                              icon: const Icon(Icons.close),
                                              onPressed: () => _removePhoto(photo),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  )
                                      .toList(),
                                ..._newPhotos
                                    .map(
                                      (photo) => GestureDetector(
                                    onTap: () => Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => Scaffold(
                                          appBar: CustomAppBar(
                                            title: 'Photo Preview',
                                            showBackButton: true,
                                          ),
                                          body: Center(
                                            child: Image.file(
                                              photo,
                                              fit: BoxFit.contain,
                                            ),
                                          ),
                                          backgroundColor: Colors.black,
                                        ),
                                      ),
                                    ),
                                    child: Stack(
                                      children: [
                                        Image.file(
                                          photo,
                                          width: 100,
                                          height: 100,
                                          fit: BoxFit.cover,
                                          errorBuilder: (_, __, ___) => const Icon(
                                            Icons.error,
                                            size: 100,
                                          ),
                                        ),
                                        Positioned(
                                          top: 0,
                                          right: 0,
                                          child: IconButton(
                                            icon: const Icon(Icons.close),
                                            onPressed: () => setState(() {
                                              _newPhotos.remove(photo);
                                              _checkForChanges();
                                            }),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                )
                                    .toList(),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ],
                    const CustomSpacer(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CustomButton(
                          label: 'Cancel',
                          onPressed: () {
                            _editStartTime = null;
                            Navigator.pop(context);
                          },
                          backgroundColor: theme.colorScheme.onSurface.withOpacity(0.6),
                          textColor: Colors.white,
                          isOutlined: true,
                        ),
                        const CustomSpacer(width: 8),
                        CustomButton(
                          label: 'Save Changes',
                          onPressed: _hasChanges ? _submitVisit : null,
                          backgroundColor: _hasChanges ? theme.colorScheme.primary.withOpacity(0.8) : theme.colorScheme.onSurface.withOpacity(0.3),
                          textColor: Colors.white,
                          isOutlined: true,
                          isLoading: _isLoading,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionCard(BuildContext context, {required String title, required List<Widget> children}) {
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

  Widget _buildSelector({
    required BuildContext context,
    required String label,
    required String value,
    required IconData icon,
    VoidCallback? onTap,
    bool disabled = false,
  }) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: InkWell(
        onTap: disabled ? null : onTap,
        borderRadius: BorderRadius.circular(8),
        splashColor: theme.colorScheme.primary.withOpacity(0.2),
        highlightColor: theme.colorScheme.primary.withOpacity(0.1),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            border: Border.all(
              color: disabled
                  ? theme.colorScheme.onSurface.withOpacity(0.3)
                  : theme.colorScheme.primary.withOpacity(0.7),
              width: 1.5,
            ),
            borderRadius: BorderRadius.circular(8),
            color: disabled
                ? theme.colorScheme.background.withOpacity(0.5)
                : theme.colorScheme.background,
          ),
          child: Row(
            children: [
              Icon(
                icon,
                color: disabled
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
                        color: disabled
                            ? theme.colorScheme.onSurface.withOpacity(0.5)
                            : theme.colorScheme.onSurface.withOpacity(0.7),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      value,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: disabled
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
                color: disabled
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
}