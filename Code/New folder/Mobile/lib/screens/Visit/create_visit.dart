import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;
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
import '../../widgets/commen/snack_bar.dar.dart';
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
  bool _isRecruitmentVisit = false;
  Map<String, dynamic>? _selectedGovernorate;
  Map<String, dynamic>? _selectedDelegation;

  @override
  void initState() {
    super.initState();
    developer.log('[CreateVisitScreen] Initializing with week: ${widget.weekNumber}, year: ${widget.year}', name: 'CreateVisitScreen.initState');
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
    developer.log('[CreateVisitScreen] Disposing', name: 'CreateVisitScreen.dispose');
    _debounce?.cancel();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    developer.log('[CreateVisitScreen] Starting initial data load', name: 'CreateVisitScreen.loadInitialData');
    setState(() => _isLoading = true);
    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      final locationProvider = Provider.of<LocationProvider>(context, listen: false);
      final checklistProvider = Provider.of<ChecklistProvider>(context, listen: false);
      final reasonProvider = Provider.of<ReasonProvider>(context, listen: false);

      final supervisorID = authProvider.user!.userID;
      developer.log('[CreateVisitScreen] Fetching data for supervisor ID: $supervisorID', name: 'CreateVisitScreen.loadInitialData');

      final regionalManager = await userProvider.getRegionalManagerBySupervisor(supervisorID);
      final regionalManagerID = regionalManager.userID;

      developer.log(
        '[CreateVisitScreen] Regional manager ID fetched: ${regionalManagerID ?? 'null'}',
        name: 'CreateVisitScreen.loadInitialData',
      );

      if (regionalManagerID != null) {
        developer.log(
          '[CreateVisitScreen] Fetching regions for regional manager ID: $regionalManagerID',
          name: 'CreateVisitScreen.loadInitialData',
        );
        await locationProvider.getRegionsByUser(regionalManagerID);
        _regions = locationProvider.regions;
        developer.log(
          '[CreateVisitScreen] Regions fetched: ${_regions.map((r) => r['name']).toList()}',
          name: 'CreateVisitScreen.loadInitialData',
        );
      } else {
        developer.log('[CreateVisitScreen] Fetching all regions (no regional manager)', name: 'CreateVisitScreen.loadInitialData');
        await locationProvider.getAllRegions();
        _regions = locationProvider.regions;
        developer.log(
          '[CreateVisitScreen] All regions fetched: ${_regions.map((r) => r['name']).toList()}',
          name: 'CreateVisitScreen.loadInitialData',
        );
      }

      developer.log('[CreateVisitScreen] Fetching checklists and reasons', name: 'CreateVisitScreen.loadInitialData');
      await Future.wait([
        checklistProvider.getAllChecklists(),
        reasonProvider.getAllReasons(),
      ]);
      developer.log(
        '[CreateVisitScreen] Checklists fetched: ${checklistProvider.allChecklists.map((c) => c.item).toList()}',
        name: 'CreateVisitScreen.loadInitialData',
      );
      developer.log(
        '[CreateVisitScreen] Reasons fetched: ${reasonProvider.allReasons.map((r) => r.item).toList()}',
        name: 'CreateVisitScreen.loadInitialData',
      );

      developer.log('[CreateVisitScreen] Initial data loaded successfully', name: 'CreateVisitScreen.loadInitialData');
    } catch (e, stackTrace) {
      developer.log(
        '[CreateVisitScreen] Error loading initial data: $e',
        name: 'CreateVisitScreen.loadInitialData',
        error: e,
        stackTrace: stackTrace,
      );
      _showSnackBar('Failed to load initial data: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  int _getWeekNumber(DateTime date) {
    final utcDate = DateTime.utc(date.year, date.month, date.day);
    final dayOfYear = utcDate.difference(DateTime.utc(date.year, 1, 1)).inDays + 1;
    return ((dayOfYear - utcDate.weekday + 10) / 7).floor();
  }

  Future<void> _selectDate(BuildContext context) async {
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
        developer.log('[CreateVisitScreen] Date selected: $_selectedDate', name: 'CreateVisitScreen.selectDate');
      });
    }
  }

  Future<void> _selectTime(BuildContext context) async {
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
        developer.log(
          '[CreateVisitScreen] Time selected: ${_selectedTime!.format(context)}',
          name: 'CreateVisitScreen.selectTime',
        );
      });
    }
  }

  Future<void> _showLocationDialog(BuildContext context, String type) async {
    final locationProvider = Provider.of<LocationProvider>(context, listen: false);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    List<dynamic> items;
    String? selectedValue;

    developer.log(
      '[CreateVisitScreen] Opening location dialog for type: $type',
      name: 'CreateVisitScreen.showLocationDialog',
    );

    switch (type) {
      case 'region':
        items = _regions;
        selectedValue = _selectedRegionId;
        developer.log(
          '[CreateVisitScreen] Displaying regions: ${items.map((r) => r['name']).toList()}',
          name: 'CreateVisitScreen.showLocationDialog',
        );
        break;
      case 'governorate':
        developer.log(
          '[CreateVisitScreen] Fetching governorates for region ID: $_selectedRegionId',
          name: 'CreateVisitScreen.showLocationDialog',
        );
        final regionGovs = await LocationService.getGovernoratesByRegion(_selectedRegionId!);
        developer.log(
          '[CreateVisitScreen] Governorates fetched for region: ${regionGovs.map((g) => g['name']).toList()}',
          name: 'CreateVisitScreen.showLocationDialog',
        );
        developer.log(
          '[CreateVisitScreen] Fetching supervisor governorates for user ID: ${authProvider.user!.userID}',
          name: 'CreateVisitScreen.showLocationDialog',
        );
        final supervisorGovs = await LocationService.getGovernoratesByUser(authProvider.user!.userID);
        developer.log(
          '[CreateVisitScreen] Supervisor governorates fetched: ${supervisorGovs.map((g) => g['name']).toList()}',
          name: 'CreateVisitScreen.showLocationDialog',
        );
        items = regionGovs.where((g) => supervisorGovs.any((sg) => sg['governorateID'] == g['governorateID'])).toList();
        developer.log(
          '[CreateVisitScreen] Filtered governorates: ${items.map((g) => g['name']).toList()}',
          name: 'CreateVisitScreen.showLocationDialog',
        );
        selectedValue = _selectedGovernorateId;
        break;
      case 'delegation':
        developer.log(
          '[CreateVisitScreen] Fetching delegations for governorate ID: $_selectedGovernorateId',
          name: 'CreateVisitScreen.showLocationDialog',
        );
        final govDels = await LocationService.getDelegationsByGovernorate(_selectedGovernorateId!);
        developer.log(
          '[CreateVisitScreen] Delegations fetched for governorate: ${govDels.map((d) => d['name']).toList()}',
          name: 'CreateVisitScreen.showLocationDialog',
        );
        developer.log(
          '[CreateVisitScreen] Fetching supervisor delegations for user ID: ${authProvider.user!.userID}',
          name: 'CreateVisitScreen.showLocationDialog',
        );
        final supervisorDels = await LocationService.getDelegationsByUser(authProvider.user!.userID);
        developer.log(
          '[CreateVisitScreen] Supervisor delegations fetched: ${supervisorDels.map((d) => d['name']).toList()}',
          name: 'CreateVisitScreen.showLocationDialog',
        );
        items = govDels.where((d) => supervisorDels.any((sd) => sd['delegationID'] == d['delegationID'])).toList();
        developer.log(
          '[CreateVisitScreen] Filtered delegations: ${items.map((d) => d['name']).toList()}',
          name: 'CreateVisitScreen.showLocationDialog',
        );
        selectedValue = _selectedDelegationId;
        break;
      default:
        developer.log(
          '[CreateVisitScreen] Invalid location type: $type',
          name: 'CreateVisitScreen.showLocationDialog',
        );
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
                      developer.log(
                        '[CreateVisitScreen] Filtered $type items: ${filteredItems.map((item) => item['name']).toList()}',
                        name: 'CreateVisitScreen.showLocationDialog',
                      );
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
                              developer.log(
                                '[CreateVisitScreen] Selected region: ${item['name']} (ID: ${item['${type}ID']}), resetting governorate and delegation',
                                name: 'CreateVisitScreen.showLocationDialog',
                              );
                            } else if (type == 'governorate') {
                              _selectedGovernorate = item;
                              _selectedGovernorateId = item['${type}ID'];
                              _selectedDelegationId = null;
                              _selectedDelegation = null;
                              developer.log(
                                '[CreateVisitScreen] Selected governorate: ${item['name']} (ID: ${item['${type}ID']}), resetting delegation',
                                name: 'CreateVisitScreen.showLocationDialog',
                              );
                            } else {
                              _selectedDelegation = item;
                              _selectedDelegationId = item['${type}ID'];
                              developer.log(
                                '[CreateVisitScreen] Selected delegation: ${item['name']} (ID: ${item['${type}ID']})',
                                name: 'CreateVisitScreen.showLocationDialog',
                              );
                            }
                            if (!_isRecruitmentVisit) {
                              _selectedAgentId = null;
                              _phoneController.clear();
                              _agentPhone = '';
                              _phoneError = null;
                              developer.log(
                                '[CreateVisitScreen] Reset agent selection and phone input due to $type change',
                                name: 'CreateVisitScreen.showLocationDialog',
                              );
                            }
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
    if (!mounted) {
      developer.log('[CreateVisitScreen] Widget not mounted, aborting agent dialog', name: 'CreateVisitScreen.showAgentDialog');
      return;
    }

    final dialogContext = context;
    final authProvider = Provider.of<AuthProvider>(dialogContext, listen: false);

    developer.log('[CreateVisitScreen] Opening agent dialog for delegation ID: $_selectedDelegationId', name: 'CreateVisitScreen.showAgentDialog');
    setState(() => _isLoading = true);

    try {
      developer.log('[CreateVisitScreen] Fetching agents for supervisor ID: ${authProvider.user!.userID}', name: 'CreateVisitScreen.showAgentDialog');
      await agentProvider.getAgentsByUser(authProvider.user!.userID);
      final supervisorAgents = List<Agent>.from(agentProvider.agents);
      developer.log('[CreateVisitScreen] Supervisor agents fetched: ${supervisorAgents.map((a) => '${a.name} ${a.lastname} (${a.phone})').toList()}', name: 'CreateVisitScreen.showAgentDialog');

      developer.log('[CreateVisitScreen] Fetching agents for delegation ID: $_selectedDelegationId', name: 'CreateVisitScreen.showAgentDialog');
      final delegationAgents = await agentProvider.fetchAgentsByDelegation(_selectedDelegationId!);
      developer.log('[CreateVisitScreen] Delegation agents fetched: ${delegationAgents.map((a) => '${a.name} ${a.lastname} (${a.phone})').toList()}', name: 'CreateVisitScreen.showAgentDialog');

      final filteredAgents = supervisorAgents.where((a) => delegationAgents.any((da) => da.agentID == a.agentID)).toList();
      developer.log('[CreateVisitScreen] Filtered agents (intersection): ${filteredAgents.map((a) => '${a.name} ${a.lastname} (${a.phone})').toList()}', name: 'CreateVisitScreen.showAgentDialog');

      if (!mounted) {
        developer.log('[CreateVisitScreen] Widget not mounted after fetching agents, aborting dialog', name: 'CreateVisitScreen.showAgentDialog');
        return;
      }

      setState(() => _isLoading = false);

      final TextEditingController searchController = TextEditingController();
      List<Agent> filteredItems = List.from(filteredAgents);

      if (!mounted || !dialogContext.mounted) {
        developer.log('[CreateVisitScreen] Context not valid for dialog, aborting', name: 'CreateVisitScreen.showAgentDialog');
        if (mounted) {
          _showSnackBar('Unable to show agents: Screen is no longer active');
        }
        return;
      }

      await showDialog<void>(
        context: dialogContext,
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
                        developer.log('[CreateVisitScreen] Filtered agents: ${filteredItems.map((a) => '${a.name} ${a.lastname} (ID: ${a.agentID})').toList()}', name: 'CreateVisitScreen.showAgentDialog');
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
                            if (mounted) {
                              setState(() {
                                _selectedAgentId = agent.agentID;
                                _phoneController.text = agent.phone ?? '';
                                _agentPhone = agent.phone ?? '';
                                developer.log('[CreateVisitScreen] Selected agent: ${agent.name} ${agent.lastname} (ID: ${agent.agentID}, Phone: ${agent.phone})', name: 'CreateVisitScreen.showAgentDialog');
                              });
                              Navigator.pop(dialogBuilderContext);
                            }
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
    } catch (e, stackTrace) {
      if (mounted) {
        setState(() => _isLoading = false);
        _showSnackBar('Failed to load agents: $e');
      }
      developer.log('[CreateVisitScreen] Error in showAgentDialog: $e', name: 'CreateVisitScreen.showAgentDialog', error: e, stackTrace: stackTrace);
    }
  }

  Future<void> _showChecklistDialog(BuildContext context, ChecklistProvider checklistProvider) async {
    final allChecklists = checklistProvider.allChecklists;
    final selectedChecklists = List<Checklist>.from(_selectedChecklists);
    final TextEditingController searchController = TextEditingController();
    List<Checklist> filteredChecklists = List.from(allChecklists);
    developer.log(
      '[CreateVisitScreen] Showing checklists: ${allChecklists.map((c) => c.item).toList()}',
      name: 'CreateVisitScreen.showChecklistDialog',
    );

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
                      developer.log(
                        '[CreateVisitScreen] Filtered checklists: ${filteredChecklists.map((c) => c.item).toList()}',
                        name: 'CreateVisitScreen.showChecklistDialog',
                      );
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
                              developer.log(
                                '[CreateVisitScreen] Checklist ${checklist.item} ${value == true ? 'added' : 'removed'}, current selection: ${selectedChecklists.map((c) => c.item).toList()}',
                                name: 'CreateVisitScreen.showChecklistDialog',
                              );
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
                  developer.log(
                    '[CreateVisitScreen] Confirmed checklists: ${_selectedChecklists.map((c) => c.item).toList()}',
                    name: 'CreateVisitScreen.showChecklistDialog',
                  );
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
    final allReasons = reasonProvider.allReasons;
    final selectedReasons = List<Reason>.from(_selectedReasons);
    final TextEditingController searchController = TextEditingController();
    List<Reason> filteredReasons = List.from(allReasons);
    developer.log(
      '[CreateVisitScreen] Showing reasons: ${allReasons.map((r) => r.item).toList()}',
      name: 'CreateVisitScreen.showReasonDialog',
    );

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
                      developer.log(
                        '[CreateVisitScreen] Filtered reasons: ${filteredReasons.map((r) => r.item).toList()}',
                        name: 'CreateVisitScreen.showReasonDialog',
                      );
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
                              developer.log(
                                '[CreateVisitScreen] Reason ${reason.item} ${value == true ? 'added' : 'removed'}, current selection: ${selectedReasons.map((r) => r.item).toList()}',
                                name: 'CreateVisitScreen.showReasonDialog',
                              );
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
                  developer.log(
                    '[CreateVisitScreen] Confirmed reasons: ${_selectedReasons.map((r) => r.item).toList()}',
                    name: 'CreateVisitScreen.showReasonDialog',
                  );
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
    developer.log('[CreateVisitScreen] Phone input changed: $value', name: 'CreateVisitScreen.onPhoneChanged');
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
                });
              } else {
                setState(() => _phoneError = 'Invalid location data for agent');
              }
            } else {
              setState(() {
                _phoneError = 'Agent not assigned to supervisor';
                _selectedAgentId = null;
                _selectedDelegationId = null;
              });
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
    if (!_isRecruitmentVisit && _selectedAgentId == null) {
      _showSnackBar('An agent must be selected');
      return false;
    }
    if (!_isRecruitmentVisit && _selectedDelegationId == null) {
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
    if (_isLoading || !_formKey.currentState!.validate() || !_validateInputs()) return;
    developer.log('[CreateVisitScreen] Starting visit submission', name: 'CreateVisitScreen.submitVisit');
    setState(() => _isLoading = true);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);
    final locationProvider = Provider.of<LocationProvider>(context, listen: false);

    try {
      String? location;
      if (_selectedDelegationId != null) {
        developer.log(
          '[CreateVisitScreen] Fetching region details for region ID: $_selectedRegionId',
          name: 'CreateVisitScreen.submitVisit',
        );
        final region = _regions.firstWhere((r) => r['regionID'] == _selectedRegionId, orElse: () => null);
        developer.log(
          '[CreateVisitScreen] Region found: ${region != null ? region['name'] : 'Not found'}',
          name: 'CreateVisitScreen.submitVisit',
        );

        developer.log(
          '[CreateVisitScreen] Fetching governorates for region ID: $_selectedRegionId',
          name: 'CreateVisitScreen.submitVisit',
        );
        await locationProvider.getGovernoratesByRegion(_selectedRegionId!);
        final governorate = locationProvider.governorates.firstWhere((g) => g['governorateID'] == _selectedGovernorateId, orElse: () => null);
        developer.log(
          '[CreateVisitScreen] Governorate found: ${governorate != null ? governorate['name'] : 'Not found'}',
          name: 'CreateVisitScreen.submitVisit',
        );

        developer.log(
          '[CreateVisitScreen] Fetching delegations for governorate ID: $_selectedGovernorateId',
          name: 'CreateVisitScreen.submitVisit',
        );
        await locationProvider.getDelegationsByGovernorate(_selectedGovernorateId!);
        final delegation = locationProvider.delegations.firstWhere((d) => d['delegationID'] == _selectedDelegationId, orElse: () => null);
        developer.log(
          '[CreateVisitScreen] Delegation found: ${delegation != null ? delegation['name'] : 'Not found'}',
          name: 'CreateVisitScreen.submitVisit',
        );

        location = [region?['name'], governorate?['name'], delegation?['name']].where((e) => e != null).join(', ');
        developer.log(
          '[CreateVisitScreen] Constructed location string: $location',
          name: 'CreateVisitScreen.submitVisit',
        );
      }

      final checklistUpdates = _selectedChecklists.map((c) => {'id': c.checklistID}).toList();
      final reasonUpdates = _selectedReasons.map((r) => {'id': r.reasonID}).toList();

      final visit = {
        'date': _selectedDate!.toIso8601String().split('T')[0],
        'time': _selectedTime!.format(context).toLowerCase().replaceAll(' ', ''),
        'agentID': _isRecruitmentVisit ? null : _selectedAgentId,
        'location': location,
        'reasons': reasonUpdates,
        'checklists': checklistUpdates,
      };
      developer.log(
        '[CreateVisitScreen] Visit data prepared: ${jsonEncode(visit)}',
        name: 'CreateVisitScreen.submitVisit',
      );

      developer.log(
        '[CreateVisitScreen] Creating timesheet for supervisor ID: ${authProvider.user!.userID}, week: ${_getWeekNumber(_selectedDate!)}, year: ${_selectedDate!.year}',
        name: 'CreateVisitScreen.submitVisit',
      );
      await timesheetProvider.createTimesheetForSupervisor(
        weekNumber: _getWeekNumber(_selectedDate!),
        year: _selectedDate!.year,
        supervisorID: authProvider.user!.userID,
        visits: [visit],
        status: 'pending',
      );

      developer.log('[CreateVisitScreen] Visit created successfully', name: 'CreateVisitScreen.submitVisit');
      Navigator.pop(context);
      _showSnackBar('Visit created successfully');
    } catch (e, stackTrace) {
      _showSnackBar('Failed to create visit: $e');
      developer.log(
        '[CreateVisitScreen] Error creating visit: $e',
        name: 'CreateVisitScreen.submitVisit',
        error: e,
        stackTrace: stackTrace,
      );
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
      developer.log(
        '[CreateVisitScreen] Recruitment visit toggled: $value',
        name: 'CreateVisitScreen.handleRecruitmentVisitToggle',
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Visit'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      drawer: const AppSidebar(),
      body: Builder(
        builder: (scaffoldContext) {
          return Padding(
            padding: const EdgeInsets.all(8.0),
            child: Column(
              children: [
                Expanded(
                  child: _isLoading
                      ? const Center(child: CircularProgressIndicator())
                      : Form(
                    key: _formKey,
                    child: ListView(
                      children: [
                        _buildSectionCard(
                          scaffoldContext,
                          title: 'Date & Time',
                          children: [
                            _buildSelector(
                              context: scaffoldContext,
                              label: 'Date',
                              value: _selectedDate == null
                                  ? 'Select Date'
                                  : '${_selectedDate!.day}/${_selectedDate!.month}/${_selectedDate!.year}',
                              icon: Icons.calendar_today_outlined,
                              onTap: () => _selectDate(scaffoldContext),
                            ),
                            _buildSelector(
                              context: scaffoldContext,
                              label: 'Time',
                              value: _selectedTime == null
                                  ? 'Select Time'
                                  : _selectedTime!.format(scaffoldContext),
                              icon: Icons.access_time_outlined,
                              onTap: () => _selectTime(scaffoldContext),
                            ),
                          ],
                        ),
                        const CustomSpacer(height: 8),
                        _buildSectionCard(
                          scaffoldContext,
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
                          scaffoldContext,
                          title: 'Location & Agent',
                          children: [
                            Consumer2<AgentProvider, LocationProvider>(
                              builder: (context, agentProvider, locationProvider, child) {
                                return Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _buildSelector(
                                      context: scaffoldContext,
                                      label: 'Region',
                                      value: _selectedRegionId == null
                                          ? 'Select Region'
                                          : _regions.firstWhere(
                                              (r) => r['regionID'] == _selectedRegionId)['name'],
                                      icon: Icons.location_on_outlined,
                                      onTap: () => _showLocationDialog(scaffoldContext, 'region'),
                                    ),
                                    _buildSelector(
                                      context: scaffoldContext,
                                      label: 'Governorate',
                                      value: _selectedGovernorate == null
                                          ? 'Select Governorate'
                                          : _selectedGovernorate!['name'],
                                      icon: Icons.location_city_outlined,
                                      onTap: _selectedRegionId == null
                                          ? null
                                          : () => _showLocationDialog(scaffoldContext, 'governorate'),
                                      disabled: _selectedRegionId == null,
                                    ),
                                    _buildSelector(
                                      context: scaffoldContext,
                                      label: 'Delegation',
                                      value: _selectedDelegation == null
                                          ? 'Select Delegation'
                                          : _selectedDelegation!['name'],
                                      icon: Icons.place_outlined,
                                      onTap: _selectedGovernorateId == null
                                          ? null
                                          : () => _showLocationDialog(scaffoldContext, 'delegation'),
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
                                        context: scaffoldContext,
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
                                            : () => _showAgentDialog(scaffoldContext, agentProvider),
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
                          scaffoldContext,
                          title: 'Checklists',
                          children: [
                            Consumer<ChecklistProvider>(
                              builder: (context, checklistProvider, child) {
                                return Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _buildSelector(
                                      context: scaffoldContext,
                                      label: 'Checklists',
                                      value: _selectedChecklists.isEmpty
                                          ? 'Select Checklists'
                                          : '${_selectedChecklists.length} selected',
                                      icon: Icons.checklist,
                                      onTap: () => _showChecklistDialog(scaffoldContext, checklistProvider),
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
                                            onDeleted: () => setState(() => _selectedChecklists.remove(checklist)),
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
                          scaffoldContext,
                          title: 'Reasons',
                          children: [
                            Consumer<ReasonProvider>(
                              builder: (context, reasonProvider, child) {
                                return Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _buildSelector(
                                      context: scaffoldContext,
                                      label: 'Reasons',
                                      value: _selectedReasons.isEmpty
                                          ? 'Select Reasons'
                                          : '${_selectedReasons.length} selected',
                                      icon: Icons.list_alt_outlined,
                                      onTap: () => _showReasonDialog(scaffoldContext, reasonProvider),
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
                                            onDeleted: () => setState(() => _selectedReasons.remove(reason)),
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
                        const CustomSpacer(height: 16),
                        CustomButton(
                          label: 'Create Visit',
                          onPressed: _submitVisit,
                          backgroundColor: theme.colorScheme.primary.withOpacity(0.8),
                          textColor: Colors.white,
                          isOutlined: true,
                          isLoading: _isLoading,
                        ),
                      ],
                    ),
                  ),
                ),

                  ],
                ),

          );
        },
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