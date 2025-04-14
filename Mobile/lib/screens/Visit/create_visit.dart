import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import '../../models/checklist.dart';
import '../../models/reason.dart';
import '../../models/agent.dart';
import '../../providers/auth_provider.dart';
import '../../providers/timesheet_provider.dart';
import '../../providers/agent_provider.dart';
import '../../providers/checklist_provider.dart';
import '../../providers/reason_provider.dart';
import '../../services/cookie_manager.dart';
import '../../widgets/appbar/app_bar.dart';
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
  String? _location;
  String _agentPhone = '';
  String? _phoneError;
  Timer? _debounce;
  final TextEditingController _phoneController = TextEditingController();
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    if (kDebugMode) print('CreateVisitScreen initState, week: ${widget.weekNumber}, year: ${widget.year}');
    final calculatedDate = DateTime(widget.year, 1, 1).add(Duration(days: (widget.weekNumber - 1) * 7));
    final now = DateTime.now();
    _selectedDate = calculatedDate.isBefore(now) ? now : calculatedDate;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadInitialData();
    });
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
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, loading cookies');
        await CookieManager.loadCookies();
      }
      final agentProvider = Provider.of<AgentProvider>(context, listen: false);
      final checklistProvider = Provider.of<ChecklistProvider>(context, listen: false);
      final reasonProvider = Provider.of<ReasonProvider>(context, listen: false);

      await Future.wait([
        agentProvider.fetchUniqueLocations(),
        checklistProvider.getAllChecklists(),
        reasonProvider.getAllReasons(),
      ]);
      if (kDebugMode) print('Initial data loaded successfully');
    } catch (e) {
      if (kDebugMode) print('Error loading initial data: $e');
      _showSnackBar('Failed to load initial data: $e');
      if (e.toString().contains('401')) {
        await authProvider.logout();
        Navigator.pushReplacementNamed(context, '/login');
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  int _getWeekNumber(DateTime date) {
    final utcDate = DateTime.utc(date.year, date.month, date.day);
    final dayOfWeek = utcDate.weekday % 7;
    final adjustedDate = utcDate.add(Duration(days: 4 - (dayOfWeek == 0 ? 7 : dayOfWeek)));
    final yearStart = DateTime.utc(adjustedDate.year, 1, 1);
    final diffMillis = adjustedDate.millisecondsSinceEpoch - yearStart.millisecondsSinceEpoch;
    final diffDays = diffMillis / 86400000;
    final weekNumber = ((diffDays + 1) / 7).ceil();
    if (kDebugMode) print('Calculated week number: $weekNumber for date: $date');
    return weekNumber;
  }

  Future<void> _selectDate(BuildContext context) async {
    if (kDebugMode) print('Selecting date');
    final now = DateTime.now();
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now(),
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: DateTime.now().add(const Duration(days: 365)),
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
        if (kDebugMode) print('Date selected: $_selectedDate');
      });
    }
  }

  Future<void> _selectTime(BuildContext context) async {
    if (kDebugMode) print('Selecting time');
    final now = DateTime.now();
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
      final selectedDate = _selectedDate ?? now;
      final selectedDateTime = DateTime(
        selectedDate.year,
        selectedDate.month,
        selectedDate.day,
        picked.hour,
        picked.minute,
      );

      if (selectedDate.day == now.day && selectedDateTime.isBefore(now)) {
        if (kDebugMode) print('Invalid time: before now for today');
        _showSnackBar('Time cannot be before now for today');
        return;
      }

      setState(() {
        _selectedTime = picked;
        if (kDebugMode) print('Time selected: ${_selectedTime!.format(context)}');
      });
    }
  }

  Future<void> _showLocationDialog(BuildContext context, AgentProvider agentProvider) async {
    if (kDebugMode) print('Showing location dialog');
    final locations = agentProvider.uniqueLocations;
    final TextEditingController searchController = TextEditingController();
    List<String> filteredLocations = List.from(locations);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: Theme.of(context).cardTheme.color,
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
                    const CustomSpacer(height: 12),
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
                              if (kDebugMode) print('Location selected: $value');
                              setState(() {
                                _location = value;
                                _selectedAgentId = null;
                                agentProvider.fetchAgentsByLocation(value!);
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
                  onPressed: () {
                    if (kDebugMode) print('Location dialog cancelled');
                    Navigator.pop(context);
                  },
                  child: Text('Cancel',
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6))),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _showAgentDialog(BuildContext context, AgentProvider agentProvider) async {
    if (kDebugMode) print('Showing agent dialog');
    final agents = agentProvider.agents;
    final TextEditingController searchController = TextEditingController();
    List<Agent> filteredAgents = List.from(agents);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: Theme.of(context).cardTheme.color,
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
                          '${agent.name} ${agent.lastname}'.toLowerCase().contains(value.toLowerCase()) ||
                              agent.agentID!.toLowerCase().contains(value.toLowerCase()))
                              .toList();
                        });
                      },
                    ),
                    const CustomSpacer(height: 12),
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
                              if (kDebugMode) print('Agent selected: $value');
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
                  onPressed: () {
                    if (kDebugMode) print('Agent dialog cancelled');
                    Navigator.pop(context);
                  },
                  child: Text('Cancel',
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6))),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _showChecklistDialog(BuildContext context, ChecklistProvider checklistProvider) async {
    if (kDebugMode) print('Showing checklist dialog');
    final allChecklists = checklistProvider.allChecklists;
    final selectedChecklists = List<Checklist>.from(_selectedChecklists);
    final TextEditingController searchController = TextEditingController();
    List<Checklist> filteredChecklists = List.from(allChecklists);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: Theme.of(context).cardTheme.color,
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
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onChanged: (value) {
                        setDialogState(() {
                          filteredChecklists = allChecklists
                              .where((checklist) => checklist.item.toLowerCase().contains(value.toLowerCase()))
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
                          final isSelected = selectedChecklists.any((c) => c.checklistID == checklist.checklistID);
                          return CheckboxListTile(
                            title: Text(checklist.item),
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
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    if (kDebugMode) print('Checklist dialog cancelled');
                    Navigator.pop(context);
                  },
                  child: Text('Cancel',
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6))),
                ),
                CustomButton(
                  label: 'Confirm',
                  onPressed: () {
                    if (kDebugMode) print('Checklists confirmed: ${selectedChecklists.length} selected');
                    setState(() => _selectedChecklists = selectedChecklists);
                    Navigator.pop(context);
                  },
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _showReasonDialog(BuildContext context, ReasonProvider reasonProvider) async {
    if (kDebugMode) print('Showing reason dialog');
    final allReasons = reasonProvider.allReasons;
    final selectedReasons = List<Reason>.from(_selectedReasons);
    final TextEditingController searchController = TextEditingController();
    List<Reason> filteredReasons = List.from(allReasons);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: Theme.of(context).cardTheme.color,
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
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onChanged: (value) {
                        setDialogState(() {
                          filteredReasons = allReasons
                              .where((reason) => reason.item.toLowerCase().contains(value.toLowerCase()))
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
                          final isSelected = selectedReasons.any((r) => r.reasonID == reason.reasonID);
                          return CheckboxListTile(
                            title: Text(reason.item),
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
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    if (kDebugMode) print('Reason dialog cancelled');
                    Navigator.pop(context);
                  },
                  child: Text('Cancel',
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6))),
                ),
                CustomButton(
                  label: 'Confirm',
                  onPressed: () {
                    if (kDebugMode) print('Reasons confirmed: ${selectedReasons.length} selected');
                    setState(() => _selectedReasons = selectedReasons);
                    Navigator.pop(context);
                  },
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _onPhoneChanged(String value, AgentProvider agentProvider) {
    if (kDebugMode) print('Phone number changed: $value');
    setState(() {
      _agentPhone = value;
      _phoneError = null;
    });

    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () async {
      if (value.isEmpty) {
        if (kDebugMode) print('Phone cleared');
        setState(() {
          _selectedAgentId = null;
          _location = null;
          agentProvider.agents.clear();
        });
      } else if (value.length >= 8) {
        try {
          final authProvider = Provider.of<AuthProvider>(context, listen: false);
          if (!CookieManager.cookies.containsKey('accessToken')) {
            if (kDebugMode) print('No accessToken, loading cookies');
            await CookieManager.loadCookies();
          }
          await agentProvider.fetchAgentByPhone(value);
          final agent = agentProvider.currentAgent;
          if (agent != null) {
            setState(() {
              _selectedAgentId = agent.agentID;
              _location = agent.location;
              agentProvider.agents.clear();
              agentProvider.agents.add(agent);
              if (kDebugMode) print('Agent found by phone: ${_selectedAgentId}');
            });
          } else {
            setState(() {
              _phoneError = 'Agent not found with this phone number';
              _selectedAgentId = null;
              _location = null;
              agentProvider.agents.clear();
              if (kDebugMode) print('No agent found for phone');
            });
          }
        } catch (e) {
          if (kDebugMode) print('Error fetching agent by phone: $e');
          setState(() {
            _phoneError = 'Error fetching agent: $e';
            _selectedAgentId = null;
            _location = null;
            agentProvider.agents.clear();
          });
          if (e.toString().contains('401')) {
            final authProvider = Provider.of<AuthProvider>(context, listen: false);
            await authProvider.logout();
            Navigator.pushReplacementNamed(context, '/login');
          }
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
      if (kDebugMode) print('Invalid date: before today');
      _showSnackBar('Date cannot be before today');
      return false;
    }
    if (selectedDate.day == now.day && selectedDateTime.isBefore(now)) {
      if (kDebugMode) print('Invalid time: before now for today');
      _showSnackBar('Time cannot be before now for today');
      return false;
    }

    if (_selectedAgentId == null) {
      if (kDebugMode) print('Validation failed: no agent selected');
      _showSnackBar('An agent must be selected');
      return false;
    }
    if (_location == null) {
      if (kDebugMode) print('Validation failed: no location selected');
      _showSnackBar('A location must be selected');
      return false;
    }
    if (_selectedChecklists.isEmpty) {
      if (kDebugMode) print('Validation failed: no checklists selected');
      _showSnackBar('At least one checklist item is required');
      return false;
    }
    if (_selectedReasons.isEmpty) {
      if (kDebugMode) print('Validation failed: no reasons selected');
      _showSnackBar('At least one reason is required');
      return false;
    }

    return true;
  }

  void _submitVisit() async {
    if (_isLoading) {
      if (kDebugMode) print('Submit blocked: already loading');
      return;
    }

    if (_formKey.currentState!.validate() && _validateInputs()) {
      if (kDebugMode) print('Submitting visit');
      setState(() => _isLoading = true);
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);

      try {
        if (!CookieManager.cookies.containsKey('accessToken')) {
          if (kDebugMode) print('No accessToken, loading cookies');
          await CookieManager.loadCookies();
        }
        final supervisorID = authProvider.user?.userID;

        final checklistUpdates = _selectedChecklists.map((c) => {'id': c.checklistID}).toList();
        final reasonUpdates = _selectedReasons.map((r) => {'id': r.reasonID}).toList();

        final visit = {
          'date': _selectedDate!.toIso8601String().split('T')[0],
          'time': _selectedTime!.format(context).toLowerCase().replaceAll(' ', ''),
          'agentID': _selectedAgentId!,
          'location': _location!,
          'reasons': reasonUpdates,
          'checklists': checklistUpdates,
        };

        if (kDebugMode) print('Submitting visit payload: ${json.encode(visit)}');

        await timesheetProvider.createTimesheet(
          weekNumber: _getWeekNumber(_selectedDate!),
          year: _selectedDate!.year,
          supervisorID: supervisorID!,
          visits: [visit],
        );

        if (kDebugMode) print('Visit created successfully');
        Navigator.pop(context);
        _showSnackBar('Visit created successfully');
      } catch (e) {
        if (kDebugMode) print('Error creating visit: $e');
        _showSnackBar('Failed to create visit: $e');
        if (e.toString().contains('401')) {
          await authProvider.logout();
          Navigator.pushReplacementNamed(context, '/login');
        }
      } finally {
        if (mounted) setState(() => _isLoading = false);
      }
    }
  }

  void _showSnackBar(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: message.contains('successfully')
              ? Theme.of(context).colorScheme.primary
              : Theme.of(context).colorScheme.error,
        ),
      );
      if (kDebugMode) print('SnackBar shown: $message');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CustomAppBar(
        title: 'Create Visit',
        showBackButton: true,
      ),
      body: Container(
        color: Theme.of(context).scaffoldBackgroundColor,
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: _isLoading
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
                        title: _selectedDate == null
                            ? 'Select Date'
                            : '${_selectedDate!.day}/${_selectedDate!.month}/${_selectedDate!.year}',
                        onTap: () => _selectDate(context),
                      ),
                      const CustomSpacer(height: 12),
                      _buildTile(
                        icon: Icons.access_time,
                        title: _selectedTime == null ? 'Select Time' : _selectedTime!.format(context),
                        onTap: () => _selectTime(context),
                      ),
                    ],
                  ),
                ),
                const CustomSpacer(height: 16),
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
                              border: Border.all(
                                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.phone, color: Theme.of(context).colorScheme.primary, size: 24),
                                const CustomSpacer(width: 12),
                                Expanded(
                                  child: TextField(
                                    controller: _phoneController,
                                    keyboardType: TextInputType.number,
                                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                    maxLength: 8,
                                    decoration: InputDecoration(
                                      hintText: 'Enter agent\'s phone number',
                                      border: InputBorder.none,
                                      hintStyle: TextStyle(
                                          color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
                                      counterText: '',
                                    ),
                                    style:
                                    TextStyle(fontSize: 16, color: Theme.of(context).colorScheme.onSurface),
                                    onChanged: (value) => _onPhoneChanged(value, agentProvider),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (_phoneError != null) ...[
                            const CustomSpacer(height: 8),
                            Text(
                              _phoneError!,
                              style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12),
                            ),
                          ],
                          const CustomSpacer(height: 12),
                          GestureDetector(
                            onTap: _agentPhone.isNotEmpty
                                ? null
                                : () => _showLocationDialog(context, agentProvider),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surface,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
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
                                  const CustomSpacer(width: 12),
                                  Expanded(
                                    child: Text(
                                      _location ??
                                          (_agentPhone.isNotEmpty
                                              ? 'Selected via phone'
                                              : 'Select Location'),
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
                          const CustomSpacer(height: 12),
                          GestureDetector(
                            onTap: _agentPhone.isNotEmpty || _location == null
                                ? null
                                : () => _showAgentDialog(context, agentProvider),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surface,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
                                backgroundBlendMode:
                                _agentPhone.isNotEmpty || _location == null ? BlendMode.saturation : null,
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.person,
                                    color: _agentPhone.isNotEmpty || _location == null
                                        ? Theme.of(context).colorScheme.onSurface.withOpacity(0.6)
                                        : Theme.of(context).colorScheme.primary,
                                  ),
                                  const CustomSpacer(width: 12),
                                  Expanded(
                                    child: Text(
                                      _selectedAgentId == null
                                          ? (_agentPhone.isNotEmpty
                                          ? 'Selected via phone'
                                          : _location == null
                                          ? 'Select a location first'
                                          : 'Select Agent')
                                          : '${agentProvider.agents.firstWhere(
                                            (agent) => agent.agentID == _selectedAgentId,
                                        orElse: () => Agent(
                                            agentID: _selectedAgentId!,
                                            name: 'Loading',
                                            lastname: '...',
                                            location: ''),
                                      ).name} ${agentProvider.agents.firstWhere(
                                            (agent) => agent.agentID == _selectedAgentId,
                                        orElse: () => Agent(
                                            agentID: _selectedAgentId!,
                                            name: 'Loading',
                                            lastname: '...',
                                            location: ''),
                                      ).lastname}',
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
                const CustomSpacer(height: 16),
                _buildSectionCard(
                  title: 'Checklists',
                  child: Consumer<ChecklistProvider>(
                    builder: (context, checklistProvider, child) {
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
                                border: Border.all(
                                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
                              ),
                              child: Row(
                                children: [
                                  Icon(Icons.checklist, color: Theme.of(context).colorScheme.primary),
                                  const CustomSpacer(width: 12),
                                  Expanded(
                                    child: Text(
                                      _selectedChecklists.isEmpty
                                          ? 'Select Checklists'
                                          : '${_selectedChecklists.length} selected',
                                      style: Theme.of(context).textTheme.bodyMedium,
                                    ),
                                  ),
                                  Icon(Icons.arrow_drop_down,
                                      color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
                                ],
                              ),
                            ),
                          ),
                          if (_selectedChecklists.isNotEmpty) ...[
                            const CustomSpacer(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: _selectedChecklists.map((checklist) {
                                return Chip(
                                  label: Text(checklist.item),
                                  deleteIcon: const Icon(Icons.close, size: 18),
                                  onDeleted: () {
                                    setState(() => _selectedChecklists.remove(checklist));
                                    if (kDebugMode) print('Removed checklist: ${checklist.checklistID}');
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
                            onTap: () => _showReasonDialog(context, reasonProvider),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surface,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
                              ),
                              child: Row(
                                children: [
                                  Icon(Icons.list_alt, color: Theme.of(context).colorScheme.primary),
                                  const CustomSpacer(width: 12),
                                  Expanded(
                                    child: Text(
                                      _selectedReasons.isEmpty
                                          ? 'Select Reasons'
                                          : '${_selectedReasons.length} selected',
                                      style: Theme.of(context).textTheme.bodyMedium,
                                    ),
                                  ),
                                  Icon(Icons.arrow_drop_down,
                                      color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
                                ],
                              ),
                            ),
                          ),
                          if (_selectedReasons.isNotEmpty) ...[
                            const CustomSpacer(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: _selectedReasons.map((reason) {
                                return Chip(
                                  label: Text(reason.item),
                                  deleteIcon: const Icon(Icons.close, size: 18),
                                  onDeleted: () {
                                    setState(() => _selectedReasons.remove(reason));
                                    if (kDebugMode) print('Removed reason: ${reason.reasonID}');
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
        border: Border.all(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
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
          border: Border.all(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
        ),
        child: Row(
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary),
            const CustomSpacer(width: 12),
            Expanded(
              child: Text(
                title,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            Icon(Icons.arrow_drop_down,
                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
          ],
        ),
      ),
    );
  }
}