import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import '../../providers/checklist_provider.dart';
import '../../providers/reason_provider.dart';
import '../../providers/agent_provider.dart';
import '../../providers/location_provider.dart';
import '../../utils/constants.dart';
import '../../widgets/appbar/app_bar.dart';
import '../../widgets/appbar/sidebar.dart';
import '../../widgets/commen/spacer.dart';

class EditVisitScreen extends StatefulWidget {
  final Visit visit;

  const EditVisitScreen({super.key, required this.visit});

  @override
  State<EditVisitScreen> createState() => _EditVisitScreenState();
}

class _EditVisitScreenState extends State<EditVisitScreen> {
  late Visit _visit;
  late TextEditingController _dateController;
  late TextEditingController _timeController;
  late TextEditingController _agentPhoneController;
  late TextEditingController _commentController;
  String? _selectedRegionId;
  String? _selectedGovernorateId;
  String? _selectedDelegationId;
  String? _selectedAgentId;
  List<Checklist> _visitChecklists = [];
  List<Reason> _visitReasons = [];
  List<String> _photosToRemove = [];
  List<File> _newPhotos = [];
  bool _isLoading = false;
  bool _isInitialized = false;
  DateTime? _editStartTime;
  bool _hasChanges = false;

  @override
  void initState() {
    super.initState();
    _visit = widget.visit;
    _dateController = TextEditingController(text: DateFormat('yyyy-MM-dd').format(_visit.date));
    _timeController = TextEditingController(text: _visit.time);
    _agentPhoneController = TextEditingController();
    _commentController = TextEditingController(text: _visit.comment ?? '');
    _selectedAgentId = _visit.agentID;
    _visitChecklists = _visit.checklists != null ? List.from(_visit.checklists!) : [];
    _visitReasons = _visit.reasons != null ? List.from(_visit.reasons!) : [];

    _agentPhoneController.addListener(_onPhoneNumberChanged);
    _dateController.addListener(_checkForChanges);
    _timeController.addListener(_checkForChanges);
    _agentPhoneController.addListener(_checkForChanges);
    _commentController.addListener(_checkForChanges);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_isInitialized) _loadInitialData();
      if (_visit.status == 'visited') _startEditTimer();
    });
  }

  @override
  void dispose() {
    _agentPhoneController.removeListener(_onPhoneNumberChanged);
    _dateController.removeListener(_checkForChanges);
    _timeController.removeListener(_checkForChanges);
    _agentPhoneController.removeListener(_checkForChanges);
    _commentController.removeListener(_checkForChanges);
    _dateController.dispose();
    _timeController.dispose();
    _agentPhoneController.dispose();
    _commentController.dispose();
    super.dispose();
  }

  void _startEditTimer() {
    _editStartTime = DateTime.now();
  }

  void _onPhoneNumberChanged() {
    final phone = _agentPhoneController.text;
    if (phone.length == 8 && phone.contains(RegExp(r'^[0-9]+$'))) _fetchAgentByPhone(phone);
    _checkForChanges();
  }

  void _checkForChanges() {
    setState(() {
      _hasChanges = _dateController.text != DateFormat('yyyy-MM-dd').format(_visit.date) ||
          _timeController.text != _visit.time ||
          _agentPhoneController.text.isNotEmpty ||
          _commentController.text != (_visit.comment ?? '') ||
          _selectedRegionId != null ||
          _selectedGovernorateId != null ||
          _selectedDelegationId != null ||
          _selectedAgentId != _visit.agentID ||
          _visitChecklists.length != (_visit.checklists?.length ?? 0) ||
          _visitReasons.length != (_visit.reasons?.length ?? 0) ||
          _photosToRemove.isNotEmpty ||
          _newPhotos.isNotEmpty ||
          _visitChecklists.any((c) => c.visitChecklist?.checked !=
              (_visit.checklists?.firstWhere((vc) => vc.checklistID == c.checklistID, orElse: () => Checklist(checklistID: c.checklistID, item: c.item)).visitChecklist?.checked ?? false));
    });
  }

  Future<void> _fetchAgentByPhone(String phone) async {
    final agentProvider = Provider.of<AgentProvider>(context, listen: false);
    setState(() => _isLoading = true);
    try {
      await agentProvider.fetchAgentByPhone(phone);
      final newAgent = agentProvider.currentAgent;
      if (newAgent != null && newAgent.agentID != null) {
        setState(() {
          _selectedAgentId = newAgent.agentID;
          _selectedDelegationId = newAgent.delegationID;
        });
      } else {
        _showSnackBar('No agent found with this phone number');
      }
    } catch (e) {
      _showSnackBar('Error fetching agent: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    try {
      final checklistProvider = Provider.of<ChecklistProvider>(context, listen: false);
      final reasonProvider = Provider.of<ReasonProvider>(context, listen: false);
      final agentProvider = Provider.of<AgentProvider>(context, listen: false);
      final locationProvider = Provider.of<LocationProvider>(context, listen: false);

      await Future.wait([
        locationProvider.getAllRegions(),
        locationProvider.getAllGovernorates(),
        locationProvider.getAllDelegations(),
        agentProvider.getAgentsByUser(authProvider.user!.userID),
        checklistProvider.getAllChecklists(),
        reasonProvider.getAllReasons(),
      ]);

      final location = _visit.location;
      if (location != null) {
        final parts = location.split(', ');
        if (parts.length == 3) {
          _selectedRegionId = locationProvider.regions.firstWhere((r) => r.name == parts[0], orElse: () => null)?.regionID;
          _selectedGovernorateId = locationProvider.governorates.firstWhere((g) => g.name == parts[1], orElse: () => null)?.governorateID;
          _selectedDelegationId = locationProvider.delegations.firstWhere((d) => d.name == parts[2], orElse: () => null)?.delegationID;
        }
      }

      _isInitialized = true;
    } catch (e) {
      _showSnackBar('Failed to load initial data: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _saveChanges() async {
    if (_isLoading || !_hasChanges || !_validateInputs()) return;
    setState(() => _isLoading = true);
    final visitProvider = Provider.of<VisitProvider>(context, listen: false);
    final locationProvider = Provider.of<LocationProvider>(context, listen: false);

    try {
      String? location;
      if (_selectedRegionId != null && _selectedGovernorateId != null && _selectedDelegationId != null) {
        final region = locationProvider.regions.firstWhere((r) => r.regionID == _selectedRegionId);
        final governorate = locationProvider.governorates.firstWhere((g) => g.governorateID == _selectedGovernorateId);
        final delegation = locationProvider.delegations.firstWhere((d) => d.delegationID == _selectedDelegationId);
        location = '${region.name}, ${governorate.name}, ${delegation.name}';
      } else {
        location = _visit.location;
      }

      final checklistUpdates = _visitChecklists.map((c) => {
        'id': c.checklistID,
        'checked': c.visitChecklist?.checked ?? false,
      }).toList();

      final reasonUpdates = _visitReasons.map((r) => {'id': r.reasonID}).toList();

      int? updatedDuration = _visit.duration;
      if (_visit.status == 'visited' && _editStartTime != null) {
        updatedDuration = (_visit.duration ?? 0) + DateTime.now().difference(_editStartTime!).inMinutes;
      }

      final newStatus = _visit.status == 'visited' ? 'visited' : 'pending';
      final formattedDate = _visit.status == 'visited' ? DateFormat('yyyy-MM-dd').format(_visit.date) : _dateController.text;

      await visitProvider.updateVisit(
        visitId: _visit.visitID!,
        date: formattedDate,
        time: _timeController.text,
        duration: updatedDuration,
        location: location,
        status: newStatus,
        comment: _commentController.text,
        agentID: _selectedAgentId,
        checklists: checklistUpdates,
        reasons: reasonUpdates,
        photoPaths: _newPhotos.isNotEmpty ? _newPhotos.map((p) => p.path).toList() : null,
        photosToRemove: _photosToRemove.isNotEmpty ? _photosToRemove : null,
      );

      _showSnackBar('Visit updated successfully');
      if (mounted) Navigator.pop(context);
    } catch (e) {
      _showSnackBar('Failed to update visit: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  bool _validateInputs() {
    if (_visit.status != 'visited') {
      final now = DateTime.now();
      final selectedDate = DateTime.parse(_dateController.text);
      final selectedTime = DateFormat('HH:mm').parse(_timeController.text);
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
    }
    if (_visitChecklists.isEmpty) {
      _showSnackBar('At least one checklist is required');
      return false;
    }
    if (_visitReasons.isEmpty && _visit.status != 'visited') {
      _showSnackBar('At least one reason is required');
      return false;
    }
    return true;
  }

  void _showSnackBar(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    }
  }

  void _toggleChecklist(String checklistId, bool checked) {
    setState(() {
      final index = _visitChecklists.indexWhere((c) => c.checklistID == checklistId);
      if (index != -1) {
        _visitChecklists[index] = Checklist(
          checklistID: checklistId,
          item: _visitChecklists[index].item,
          visitChecklist: VisitChecklist(
            checked: checked,
            visitID: _visit.visitID!,
            checklistID: checklistId,
          ),
        );
      }
    });
  }

  Future<void> _addNewPhoto() async {
    if (_visit.status != 'visited') return;
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.camera);
    if (pickedFile != null) {
      setState(() {
        _newPhotos.add(File(pickedFile.path));
      });
    }
  }

  void _viewPhotoFullScreen(String photoPath) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => Scaffold(
          appBar: AppBar(title: const Text('Photo View')),
          body: Center(
            child: Image.network(
              photoPath.startsWith('http') ? photoPath : '$baseUrl$photoPath',
              fit: BoxFit.contain,
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _pickDate() async {
    if (_visit.status == 'visited') return;
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _visit.date,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date != null && mounted) {
      setState(() {
        _dateController.text = DateFormat('yyyy-MM-dd').format(date);
      });
    }
  }

  Future<void> _pickTime() async {
    if (_visit.status == 'visited') return;
    final now = DateTime.now();
    final initialTime = TimeOfDay.fromDateTime(DateFormat('HH:mm').parse(_timeController.text));
    final time = await showTimePicker(
      context: context,
      initialTime: initialTime,
    );
    if (time != null && mounted) {
      final selectedDate = DateTime.parse(_dateController.text);
      final selectedDateTime = DateTime(
        selectedDate.year,
        selectedDate.month,
        selectedDate.day,
        time.hour,
        time.minute,
      );
      if (selectedDate.day == now.day && selectedDateTime.isBefore(now)) {
        _showSnackBar('Time cannot be before now for today');
        return;
      }
      setState(() {
        _timeController.text = '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
      });
    }
  }

  Future<void> _showLocationDialog(BuildContext context, String type) async {
    if (_visit.status == 'visited') return;
    final locationProvider = Provider.of<LocationProvider>(context, listen: false);
    List<dynamic> items;
    String? selectedValue;
    switch (type) {
      case 'region':
        items = locationProvider.regions;
        selectedValue = _selectedRegionId;
        break;
      case 'governorate':
        items = locationProvider.governorates.where((g) => g.regionID == _selectedRegionId).toList();
        selectedValue = _selectedGovernorateId;
        break;
      case 'delegation':
        items = locationProvider.delegations.where((d) => d.governorateID == _selectedGovernorateId).toList();
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
          title: Text('Select $type'),
          content: SizedBox(
            width: double.maxFinite,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: searchController,
                  decoration: InputDecoration(
                    hintText: 'Search ${type}s...',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onChanged: (value) {
                    setDialogState(() {
                      filteredItems = items.where((item) => item.name.toLowerCase().contains(value.toLowerCase())).toList();
                    });
                  },
                ),
                SizedBox(
                  height: 300,
                  child: ListView.builder(
                    itemCount: filteredItems.length,
                    itemBuilder: (context, index) {
                      final item = filteredItems[index];
                      return RadioListTile<String>(
                        title: Text(item.name),
                        value: item.id,
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
              child: Text('Cancel'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showAgentDialog(BuildContext context, AgentProvider agentProvider) async {
    if (_visit.status == 'visited') return;
    final agents = agentProvider.agents.where((a) => _selectedDelegationId == null || a.delegationID == _selectedDelegationId).toList();
    final TextEditingController searchController = TextEditingController();
    List<Agent> filteredAgents = List.from(agents);

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('Select Agent'),
          content: SizedBox(
            width: double.maxFinite,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: searchController,
                  decoration: InputDecoration(
                    hintText: 'Search agents...',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onChanged: (value) {
                    setDialogState(() {
                      filteredAgents = agents.where((agent) =>
                      '${agent.name} ${agent.lastname}'.toLowerCase().contains(value.toLowerCase()) ||
                          agent.agentID.toLowerCase().contains(value.toLowerCase())).toList();
                    });
                  },
                ),
                SizedBox(
                  height: 300,
                  child: ListView.builder(
                    itemCount: filteredAgents.length,
                    itemBuilder: (context, index) {
                      final agent = filteredAgents[index];
                      return RadioListTile<String>(
                        title: Text('${agent.name} ${agent.lastname}'),
                        value: agent.agentID,
                        groupValue: _selectedAgentId,
                        onChanged: (value) {
                          setState(() => _selectedAgentId = value);
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
              child: Text('Cancel'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showChecklistDialog(BuildContext context, ChecklistProvider checklistProvider) async {
    final allChecklists = checklistProvider.allChecklists;
    final selectedChecklists = List<Checklist>.from(_visitChecklists);

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('Select Checklists'),
          content: SizedBox(
            width: double.maxFinite,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: TextEditingController(),
                  decoration: InputDecoration(
                    hintText: 'Search checklists...',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onChanged: (value) {
                    setDialogState(() {
                      selectedChecklists.retainWhere((c) => c.item.toLowerCase().contains(value.toLowerCase()));
                    });
                  },
                ),
                SizedBox(
                  height: 300,
                  child: ListView.builder(
                    itemCount: allChecklists.length,
                    itemBuilder: (context, index) {
                      final checklist = allChecklists[index];
                      final isSelected = selectedChecklists.any((c) => c.checklistID == checklist.checklistID);
                      return CheckboxListTile(
                        title: Text(checklist.item),
                        value: isSelected,
                        onChanged: (value) {
                          setDialogState(() {
                            if (value == true) {
                              selectedChecklists.add(
                                Checklist(
                                  checklistID: checklist.checklistID,
                                  item: checklist.item,
                                  visitChecklist: VisitChecklist(
                                    checked: false,
                                    visitID: _visit.visitID!,
                                    checklistID: checklist.checklistID,
                                  ),
                                ),
                              );
                            } else {
                              selectedChecklists.removeWhere((c) => c.checklistID == checklist.checklistID);
                            }
                          });
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
              child: Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  _visitChecklists = selectedChecklists;
                });
                Navigator.pop(context);
              },
              child: Text('Confirm'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showReasonDialog(BuildContext context, ReasonProvider reasonProvider) async {
    if (_visit.status == 'visited') return;
    final allReasons = reasonProvider.allReasons;
    final selectedReasons = List<Reason>.from(_visitReasons);

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('Select Reasons'),
          content: SizedBox(
            width: double.maxFinite,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: TextEditingController(),
                  decoration: InputDecoration(
                    hintText: 'Search reasons...',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onChanged: (value) {
                    setDialogState(() {
                      selectedReasons.retainWhere((r) => r.item.toLowerCase().contains(value.toLowerCase()));
                    });
                  },
                ),
                SizedBox(
                  height: 300,
                  child: ListView.builder(
                    itemCount: allReasons.length,
                    itemBuilder: (context, index) {
                      final reason = allReasons[index];
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
              child: Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  _visitReasons = selectedReasons;
                });
                Navigator.pop(context);
              },
              child: Text('Confirm'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_visit.status == 'visited' ? 'Review Visit' : 'Edit Visit'),
      ),
      drawer: const AppSidebar(),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: _isLoading && !_isInitialized
            ? const Center(child: CircularProgressIndicator())
            : ListView(
          children: [
            if (_visit.status != 'visited') ...[
              _buildSectionCard(
                title: 'Date & Time',
                child: Column(
                  children: [
                    _buildTile(
                      icon: Icons.calendar_today,
                      title: _dateController.text,
                      onTap: _pickDate,
                    ),
                    const CustomSpacer(height: 12),
                    _buildTile(
                      icon: Icons.access_time,
                      title: _timeController.text,
                      onTap: _pickTime,
                    ),
                  ],
                ),
              ),
              const CustomSpacer(height: 16),
              _buildSectionCard(
                title: 'Location & Agent',
                child: Consumer2<AgentProvider, LocationProvider>(
                  builder: (context, agentProvider, locationProvider, child) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TextField(
                          controller: _agentPhoneController,
                          keyboardType: TextInputType.number,
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                          maxLength: 8,
                          decoration: InputDecoration(
                            hintText: 'Enter agent\'s phone number',
                            prefixIcon: Icon(Icons.phone),
                          ),
                        ),
                        const CustomSpacer(height: 12),
                        GestureDetector(
                          onTap: _agentPhoneController.text.isNotEmpty
                              ? null
                              : () => _showLocationDialog(context, 'region'),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.surface,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.location_on,
                                  color: _agentPhoneController.text.isNotEmpty
                                      ? Theme.of(context).colorScheme.onSurface.withOpacity(0.6)
                                      : Theme.of(context).colorScheme.primary,
                                ),
                                const CustomSpacer(width: 12),
                                Expanded(
                                  child: Text(
                                    _selectedRegionId == null
                                        ? 'Select Region'
                                        : locationProvider.regions.firstWhere((r) => r.regionID == _selectedRegionId).name,
                                    style: TextStyle(
                                      color: _agentPhoneController.text.isNotEmpty
                                          ? Theme.of(context).colorScheme.onSurface.withOpacity(0.6)
                                          : Theme.of(context).colorScheme.onSurface,
                                    ),
                                  ),
                                ),
                                Icon(Icons.arrow_drop_down, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
                              ],
                            ),
                          ),
                        ),
                        const CustomSpacer(height: 12),
                        GestureDetector(
                          onTap: _agentPhoneController.text.isNotEmpty || _selectedRegionId == null
                              ? null
                              : () => _showLocationDialog(context, 'governorate'),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.surface,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.location_city,
                                  color: _agentPhoneController.text.isNotEmpty || _selectedRegionId == null
                                      ? Theme.of(context).colorScheme.onSurface.withOpacity(0.6)
                                      : Theme.of(context).colorScheme.primary,
                                ),
                                const CustomSpacer(width: 12),
                                Expanded(
                                  child: Text(
                                    _selectedGovernorateId == null
                                        ? 'Select Governorate'
                                        : locationProvider.governorates.firstWhere((g) => g.governorateID == _selectedGovernorateId).name,
                                    style: TextStyle(
                                      color: _agentPhoneController.text.isNotEmpty || _selectedRegionId == null
                                          ? Theme.of(context).colorScheme.onSurface.withOpacity(0.6)
                                          : Theme.of(context).colorScheme.onSurface,
                                    ),
                                  ),
                                ),
                                Icon(Icons.arrow_drop_down, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
                              ],
                            ),
                          ),
                        ),
                        const CustomSpacer(height: 12),
                        GestureDetector(
                          onTap: _agentPhoneController.text.isNotEmpty || _selectedGovernorateId == null
                              ? null
                              : () => _showLocationDialog(context, 'delegation'),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.surface,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.place,
                                  color: _agentPhoneController.text.isNotEmpty || _selectedGovernorateId == null
                                      ? Theme.of(context).colorScheme.onSurface.withOpacity(0.6)
                                      : Theme.of(context).colorScheme.primary,
                                ),
                                const CustomSpacer(width: 12),
                                Expanded(
                                  child: Text(
                                    _selectedDelegationId == null
                                        ? 'Select Delegation'
                                        : locationProvider.delegations.firstWhere((d) => d.delegationID == _selectedDelegationId).name,
                                    style: TextStyle(
                                      color: _agentPhoneController.text.isNotEmpty || _selectedGovernorateId == null
                                          ? Theme.of(context).colorScheme.onSurface.withOpacity(0.6)
                                          : Theme.of(context).colorScheme.onSurface,
                                    ),
                                  ),
                                ),
                                Icon(Icons.arrow_drop_down, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
                              ],
                            ),
                          ),
                        ),
                        const CustomSpacer(height: 12),
                        GestureDetector(
                          onTap: _agentPhoneController.text.isNotEmpty || _selectedDelegationId == null
                              ? null
                              : () => _showAgentDialog(context, agentProvider),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.surface,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.person,
                                  color: _agentPhoneController.text.isNotEmpty || _selectedDelegationId == null
                                      ? Theme.of(context).colorScheme.onSurface.withOpacity(0.6)
                                      : Theme.of(context).colorScheme.primary,
                                ),
                                const CustomSpacer(width: 12),
                                Expanded(
                                  child: Text(
                                    _selectedAgentId == null
                                        ? (_agentPhoneController.text.isNotEmpty
                                        ? 'Selected via phone'
                                        : _selectedDelegationId == null
                                        ? 'Select a delegation first'
                                        : 'Select Agent')
                                        : '${agentProvider.agents.firstWhere((agent) => agent.agentID == _selectedAgentId).name} ${agentProvider.agents.firstWhere((agent) => agent.agentID == _selectedAgentId).lastname}',
                                    style: TextStyle(
                                      color: _agentPhoneController.text.isNotEmpty || _selectedDelegationId == null
                                          ? Theme.of(context).colorScheme.onSurface.withOpacity(0.6)
                                          : Theme.of(context).colorScheme.onSurface,
                                    ),
                                  ),
                                ),
                                Icon(Icons.arrow_drop_down, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ],
            if (_visit.status == 'visited' && _visit.comment != null) ...[
              const CustomSpacer(height: 16),
              _buildSectionCard(
                title: 'Details',
                child: TextField(
                  controller: _commentController,
                  decoration: InputDecoration(
                    hintText: 'Enter comment',
                    prefixIcon: Icon(Icons.comment),
                  ),
                ),
              ),
            ],
            const CustomSpacer(height: 16),
            _buildSectionCard(
              title: 'Checklists',
              child: Consumer<ChecklistProvider>(
                builder: (context, checklistProvider, child) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      GestureDetector(
                        onTap: _visit.status != 'visited' ? () => _showChecklistDialog(context, checklistProvider) : null,
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.surface,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.checklist, color: Theme.of(context).colorScheme.primary),
                              const CustomSpacer(width: 12),
                              Expanded(
                                child: Text(
                                  _visitChecklists.isEmpty
                                      ? 'Select Checklists'
                                      : '${_visitChecklists.length} selected',
                                  style: Theme.of(context).textTheme.bodyMedium,
                                ),
                              ),
                              Icon(Icons.arrow_drop_down, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
                            ],
                          ),
                        ),
                      ),
                      if (_visitChecklists.isNotEmpty) ...[
                        const CustomSpacer(height: 8),
                        Column(
                          children: _visitChecklists.map((checklist) => CheckboxListTile(
                            title: Text(checklist.item),
                            value: checklist.visitChecklist?.checked ?? false,
                            onChanged: _visit.status == 'visited' ? (value) => _toggleChecklist(checklist.checklistID!, value!) : null,
                            enabled: _visit.status == 'visited',
                            controlAffinity: ListTileControlAffinity.leading,
                          )).toList(),
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
                      if (_visit.status != 'visited') ...[
                        GestureDetector(
                          onTap: () => _showReasonDialog(context, reasonProvider),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.surface,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.list_alt, color: Theme.of(context).colorScheme.primary),
                                const CustomSpacer(width: 12),
                                Expanded(
                                  child: Text(
                                    _visitReasons.isEmpty ? 'Select Reasons' : '${_visitReasons.length} selected',
                                    style: Theme.of(context).textTheme.bodyMedium,
                                  ),
                                ),
                                Icon(Icons.arrow_drop_down, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
                              ],
                            ),
                          ),
                        ),
                      ],
                      if (_visitReasons.isNotEmpty) ...[
                        const CustomSpacer(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: _visitReasons.map((reason) => Chip(
                            label: Text(reason.item),
                            onDeleted: _visit.status != 'visited' ? () => setState(() => _visitReasons.remove(reason)) : null,
                          )).toList(),
                        ),
                      ],
                    ],
                  );
                },
              ),
            ),
            if (_visit.photos != null && _visit.photos!.isNotEmpty || _newPhotos.isNotEmpty) ...[
              const CustomSpacer(height: 16),
              _buildSectionCard(
                title: 'Photos',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_visit.status == 'visited')
                      ElevatedButton(
                        onPressed: _addNewPhoto,
                        child: Text('Add Photo'),
                      ),
                    const CustomSpacer(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        if (_visit.photos != null)
                          ..._visit.photos!.where((p) => !_photosToRemove.contains(p)).map((photo) => GestureDetector(
                            onTap: () => _viewPhotoFullScreen(photo),
                            child: Stack(
                              children: [
                                Image.network(
                                  photo.startsWith('http') ? photo : '$baseUrl$photo',
                                  width: 100,
                                  height: 100,
                                  fit: BoxFit.cover,
                                ),
                                Positioned(
                                  top: 0,
                                  right: 0,
                                  child: IconButton(
                                    icon: const Icon(Icons.close),
                                    onPressed: () => setState(() => _photosToRemove.add(photo)),
                                  ),
                                ),
                              ],
                            ),
                          )).toList(),
                        ..._newPhotos.map((photo) => GestureDetector(
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => Scaffold(
                                appBar: AppBar(title: const Text('Photo Preview')),
                                body: Center(child: Image.file(photo, fit: BoxFit.contain)),
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
                              ),
                              Positioned(
                                top: 0,
                                right: 0,
                                child: IconButton(
                                  icon: const Icon(Icons.close),
                                  onPressed: () => setState(() => _newPhotos.remove(photo)),
                                ),
                              ),
                            ],
                          ),
                        )).toList(),
                      ],
                    ),
                  ],
                ),
              ),
            ],
            const CustomSpacer(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text('Cancel'),
                ),
                const CustomSpacer(width: 8),
                ElevatedButton(
                  onPressed: _saveChanges,
                  child: Text('Save Changes'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionCard({required String title, required Widget child}) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
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

  Widget _buildTile({required IconData icon, required String title, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary),
            const CustomSpacer(width: 12),
            Expanded(child: Text(title, style: Theme.of(context).textTheme.bodyMedium)),
            Icon(Icons.arrow_drop_down, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
          ],
        ),
      ),
    );
  }
}