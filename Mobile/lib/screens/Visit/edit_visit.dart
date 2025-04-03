import 'package:TraceFlow/widgets/appbar/sidebar.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
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
import '../../utils/constants.dart';
import '../../widgets/appbar/app_bar.dart';
import '../../widgets/commen/button.dart';
import '../../widgets/commen/card.dart';
import '../../widgets/commen/icon_button.dart';
import '../../widgets/commen/progress_indicator.dart';
import '../../widgets/commen/spacer.dart';
import '../../widgets/commen/text_field.dart';
import '../../widgets/commen/list_tile.dart';

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
  String? _selectedLocation;
  String? _selectedAgentId;
  List<Checklist> _visitChecklists = [];
  List<Reason> _visitReasons = [];
  List<String> _photosToRemove = [];
  List<File> _newPhotos = [];
  bool _isLoading = false;
  bool _isInitialized = false;
  DateTime? _editStartTime;
  bool _hasChanges = false; // Track if anything has changed

  @override
  void initState() {
    super.initState();
    _visit = widget.visit;
    _dateController = TextEditingController(
      text: DateFormat('yyyy-MM-dd').format(_visit.date),
    );
    _timeController = TextEditingController(text: _visit.time);
    _agentPhoneController = TextEditingController();
    _commentController = TextEditingController(text: _visit.comment ?? '');
    _selectedLocation = _visit.location;
    _selectedAgentId = _visit.agentID;
    _visitChecklists =
        _visit.checklists != null ? List.from(_visit.checklists!) : [];
    _visitReasons = _visit.reasons != null ? List.from(_visit.reasons!) : [];

    _agentPhoneController.addListener(_onPhoneNumberChanged);
    _dateController.addListener(_checkForChanges);
    _timeController.addListener(_checkForChanges);
    _agentPhoneController.addListener(_checkForChanges);
    _commentController.addListener(_checkForChanges);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_isInitialized) {
        _loadInitialData();
      }
      if (_visit.status == 'visited') {
        _startEditTimer();
      }
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
    if (phone.length == 8 && phone.contains(RegExp(r'^[0-9]+$'))) {
      _fetchAgentByPhone(phone);
    }
    _checkForChanges();
  }

  void _checkForChanges() {
    setState(() {
      _hasChanges =
          _dateController.text !=
              DateFormat('yyyy-MM-dd').format(_visit.date) ||
          _timeController.text != _visit.time ||
          _agentPhoneController.text.isNotEmpty ||
          _commentController.text != (_visit.comment ?? '') ||
          _selectedLocation != _visit.location ||
          _selectedAgentId != _visit.agentID ||
          _visitChecklists.length != (_visit.checklists?.length ?? 0) ||
          _visitReasons.length != (_visit.reasons?.length ?? 0) ||
          _photosToRemove.isNotEmpty ||
          _newPhotos.isNotEmpty ||
          _visitChecklists.any(
            (c) =>
                c.visitChecklist?.checked !=
                (_visit.checklists
                        ?.firstWhere(
                          (vc) => vc.checklistID == c.checklistID,
                          orElse:
                              () => Checklist(
                                checklistID: c.checklistID,
                                item: c.item,
                              ),
                        )
                        .visitChecklist
                        ?.checked ??
                    false),
          );
    });
  }

  Future<void> _fetchAgentByPhone(String phone) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final agentProvider = Provider.of<AgentProvider>(context, listen: false);
    final token = authProvider.token;

    if (token == null) return;

    setState(() => _isLoading = true);
    try {
      await agentProvider.fetchAgentByPhone(phone, token);
      final newAgent = agentProvider.currentAgent;
      if (newAgent != null && newAgent.agentID != null) {
        setState(() => _selectedAgentId = newAgent.agentID);
      } else {
        _showSnackBar('No agent found with this phone number');
      }
    } catch (e) {
      _showSnackBar('Error fetching agent: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
    _checkForChanges();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final token = authProvider.token;
      if (token == null) throw Exception('No authentication token');

      final checklistProvider = Provider.of<ChecklistProvider>(
        context,
        listen: false,
      );
      final reasonProvider = Provider.of<ReasonProvider>(
        context,
        listen: false,
      );
      final agentProvider = Provider.of<AgentProvider>(context, listen: false);

      await Future.wait([
        checklistProvider.getAllChecklists(token),
        reasonProvider.getAllReasons(token),
        agentProvider.fetchUniqueLocations(token),
        if (_selectedLocation != null)
          agentProvider.fetchAgentsByLocation(_selectedLocation!, token),
      ]);

      if (agentProvider.agents.isNotEmpty &&
          !agentProvider.agents.any((a) => a.agentID == _selectedAgentId)) {
        setState(() => _selectedAgentId = agentProvider.agents.first.agentID);
      }

      _isInitialized = true;
    } catch (e) {
      _showSnackBar('Failed to load initial data: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _saveChanges() async {
    if (_isLoading || !_hasChanges) return;

    if (!_validateInputs()) return;

    setState(() => _isLoading = true);

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final visitProvider = Provider.of<VisitProvider>(context, listen: false);
    final agentProvider = Provider.of<AgentProvider>(context, listen: false);
    final token = authProvider.token;

    if (token == null) {
      _showSnackBar('Please log in first');
      setState(() => _isLoading = false);
      return;
    }

    try {
      String? agentId = _selectedAgentId;
      if (_agentPhoneController.text.isNotEmpty && _visit.status != 'visited') {
        await agentProvider.fetchAgentByPhone(
          _agentPhoneController.text,
          token,
        );
        agentId = agentProvider.currentAgent?.agentID ?? _selectedAgentId;
      }

      final checklistUpdates =
          _visitChecklists
              .map(
                (c) => {
                  'id': c.checklistID,
                  'checked': c.visitChecklist?.checked ?? false,
                },
              )
              .toList();

      final reasonUpdates =
          _visitReasons.map((r) => {'id': r.reasonID}).toList();

      int? updatedDuration = _visit.duration;
      if (_visit.status == 'visited' && _editStartTime != null) {
        final editDuration =
            DateTime.now().difference(_editStartTime!).inMinutes;
        updatedDuration = (_visit.duration ?? 0) + editDuration;
      }

      final newStatus = _visit.status == 'visited' ? 'visited' : 'pending';
      final formattedDate =
          _visit.status == 'visited'
              ? DateFormat('yyyy-MM-dd').format(_visit.date)
              : _dateController.text;

      await visitProvider.updateVisit(
        visitId: _visit.visitID!,
        date: formattedDate,
        time: _visit.status == 'visited' ? _visit.time : _timeController.text,
        location:
            _visit.status == 'visited' ? _visit.location : _selectedLocation,
        status: newStatus,
        duration: updatedDuration,
        comment:
            _visit.status == 'visited' && _commentController.text.isNotEmpty
                ? _commentController.text
                : _visit.comment,
        agentID: _visit.status == 'visited' ? _visit.agentID : agentId,
        checklists: checklistUpdates,
        reasons: reasonUpdates,
        photoPaths:
            _newPhotos.isNotEmpty
                ? _newPhotos.map((p) => p.path).toList()
                : (_photosToRemove.isNotEmpty ? _photosToRemove : null),
        token: token,
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

      if (selectedDate.weekday == DateTime.saturday ||
          selectedDate.weekday == DateTime.sunday) {
        _showSnackBar('Date cannot be a Saturday or Sunday');
        return false;
      }
      if (selectedDate.isBefore(DateTime(now.year, now.month, now.day))) {
        _showSnackBar('Date cannot be before today');
        return false;
      }

      final startTime = DateTime(
        selectedDate.year,
        selectedDate.month,
        selectedDate.day,
        8,
        0,
      );
      final endTime = DateTime(
        selectedDate.year,
        selectedDate.month,
        selectedDate.day,
        17,
        0,
      );
      if (selectedDateTime.isBefore(startTime) ||
          selectedDateTime.isAfter(endTime)) {
        _showSnackBar('Time must be between 08:00 and 17:00');
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
      _showSnackBar('At least one checklist item is required');
      return false;
    }
    if (_visitReasons.isEmpty) {
      _showSnackBar('At least one reason is required');
      return false;
    }

    return true;
  }

  void _showSnackBar(String message) {
    if (mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    }
  }

  void _toggleChecklist(Checklist checklist, bool? value) {
    if (_visit.status != 'visited') return;
    setState(() {
      final index = _visitChecklists.indexWhere(
        (c) => c.checklistID == checklist.checklistID,
      );
      if (index != -1) {
        _visitChecklists[index] = Checklist(
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

  void _addChecklist(Checklist checklist) {
    if (!_visitChecklists.any((c) => c.checklistID == checklist.checklistID)) {
      setState(() {
        _visitChecklists.add(
          Checklist(
            checklistID: checklist.checklistID,
            item: checklist.item,
            visitChecklist: VisitChecklist(
              checked: false,
              visitID: _visit.visitID,
              checklistID: checklist.checklistID,
            ),
          ),
        );
        _checkForChanges();
      });
    }
  }

  void _removeChecklist(String checklistId) {
    setState(() {
      _visitChecklists.removeWhere((c) => c.checklistID == checklistId);
      _checkForChanges();
    });
  }

  void _addReason(Reason reason) {
    if (!_visitReasons.any((r) => r.reasonID == reason.reasonID)) {
      setState(() {
        _visitReasons.add(reason);
        _checkForChanges();
      });
    }
  }

  void _removeReason(String reasonId) {
    setState(() {
      _visitReasons.removeWhere((r) => r.reasonID == reasonId);
      _checkForChanges();
    });
  }

  void _removePhoto(String photo) {
    setState(() {
      _photosToRemove.add(photo);
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

  void _viewPhotoFullScreen(String photoPath) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder:
            (_) => Scaffold(
              appBar: CustomAppBar(title: 'Photo View', showBackButton: true),
              body: Center(
                child: Image.network(
                  photoPath.startsWith('http')
                      ? photoPath
                      : '$baseUrl$photoPath',
                  fit: BoxFit.contain,
                  errorBuilder:
                      (context, error, stackTrace) => const Icon(
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

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _visit.date,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      selectableDayPredicate:
          (DateTime date) =>
              date.weekday != DateTime.saturday &&
              date.weekday != DateTime.sunday,
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
    if (date != null && mounted) {
      setState(() {
        _dateController.text = DateFormat('yyyy-MM-dd').format(date);
        _checkForChanges();
      });
    }
  }

  Future<void> _pickTime() async {
    final now = DateTime.now();
    final initialTime = TimeOfDay.fromDateTime(
      DateFormat('HH:mm').parse(_timeController.text),
    );
    final time = await showTimePicker(
      context: context,
      initialTime: initialTime,
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
    if (time != null && mounted) {
      final selectedDate = DateTime.parse(_dateController.text);
      final selectedDateTime = DateTime(
        selectedDate.year,
        selectedDate.month,
        selectedDate.day,
        time.hour,
        time.minute,
      );
      final isToday = selectedDate.day == now.day;

      if (time.hour < 8 ||
          time.hour >= 17 ||
          (time.hour == 17 && time.minute > 0)) {
        _showSnackBar('Time must be between 08:00 and 17:00');
        return;
      }
      if (isToday && selectedDateTime.isBefore(now)) {
        _showSnackBar('Time cannot be before now for today');
        return;
      }

      setState(() {
        _timeController.text =
            '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
        _checkForChanges();
      });
    }
  }

  Future<void> _showLocationDialog(
    BuildContext context,
    AgentProvider agentProvider,
  ) async {
    final locations = agentProvider.uniqueLocations;
    final TextEditingController searchController = TextEditingController();
    List<String> filteredLocations = List.from(locations);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text(
                'Select Location',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CustomTextField(
                      controller: searchController,
                      label: 'Search locations...',
                      prefixIcon: Icons.search,
                      onSuffixPressed: null,
                    ),
                    const CustomSpacer(height: 12),
                    SizedBox(
                      height: 300,
                      child: ListView.builder(
                        itemCount: filteredLocations.length,
                        itemBuilder: (context, index) {
                          final location = filteredLocations[index];
                          return CustomListTile(
                            title: location,
                            leadingIcon: Icons.location_on,
                            onTap: () {
                              setState(() {
                                _selectedLocation = location;
                                _selectedAgentId = null;
                                agentProvider.fetchAgentsByLocation(
                                  location,
                                  Provider.of<AuthProvider>(
                                    context,
                                    listen: false,
                                  ).token!,
                                );
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
                CustomButton(
                  label: 'Cancel',
                  onPressed: () => Navigator.pop(context),
                  backgroundColor: Theme.of(context).cardTheme.color,
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _showAgentDialog(
    BuildContext context,
    AgentProvider agentProvider,
  ) async {
    final agents = agentProvider.agents;
    final TextEditingController searchController = TextEditingController();
    List<Agent> filteredAgents = List.from(agents);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text(
                'Select Agent',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CustomTextField(
                      controller: searchController,
                      label: 'Search agents...',
                      prefixIcon: Icons.search,
                      onSuffixPressed: null,
                    ),
                    const CustomSpacer(height: 12),
                    SizedBox(
                      height: 300,
                      child: ListView.builder(
                        itemCount: filteredAgents.length,
                        itemBuilder: (context, index) {
                          final agent = filteredAgents[index];
                          return CustomListTile(
                            title: '${agent.name} ${agent.lastname}',
                            leadingIcon: Icons.person,
                            onTap: () {
                              setState(() {
                                _selectedAgentId = agent.agentID;
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
                CustomButton(
                  label: 'Cancel',
                  onPressed: () => Navigator.pop(context),
                  backgroundColor: Theme.of(context).cardTheme.color,

                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _showChecklistDialog(
    BuildContext context,
    ChecklistProvider checklistProvider,
  ) async {
    final allChecklists = checklistProvider.allChecklists;
    final selectedChecklists = List<Checklist>.from(_visitChecklists);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text(
                'Select Checklists',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CustomTextField(
                      controller: TextEditingController(),
                      label: 'Search checklists...',
                      prefixIcon: Icons.search,
                      onSuffixPressed: null,
                    ),
                    const CustomSpacer(height: 12),
                    SizedBox(
                      height: 300,
                      child: ListView.builder(
                        itemCount: allChecklists.length,
                        itemBuilder: (context, index) {
                          final checklist = allChecklists[index];
                          final isSelected = selectedChecklists.any(
                            (c) => c.checklistID == checklist.checklistID,
                          );
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
                                        visitID: _visit.visitID,
                                        checklistID: checklist.checklistID,
                                      ),
                                    ),
                                  );
                                } else {
                                  selectedChecklists.removeWhere(
                                    (c) =>
                                        c.checklistID == checklist.checklistID,
                                  );
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
                CustomButton(
                  label: 'Cancel',
                  onPressed: () => Navigator.pop(context),
                  backgroundColor: Theme.of(context).cardTheme.color,

                ),
                CustomButton(
                  label: 'Confirm',
                  onPressed: () {
                    setState(() {
                      _visitChecklists = selectedChecklists;
                      _checkForChanges();
                    });
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

  Future<void> _showReasonDialog(
    BuildContext context,
    ReasonProvider reasonProvider,
  ) async {
    final allReasons = reasonProvider.allReasons;
    final selectedReasons = List<Reason>.from(_visitReasons);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text(
                'Select Reasons',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CustomTextField(
                      controller: TextEditingController(),
                      label: 'Search reasons...',
                      prefixIcon: Icons.search,
                      onSuffixPressed: null,
                    ),
                    const CustomSpacer(height: 12),
                    SizedBox(
                      height: 300,
                      child: ListView.builder(
                        itemCount: allReasons.length,
                        itemBuilder: (context, index) {
                          final reason = allReasons[index];
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
                            activeColor: Theme.of(context).colorScheme.primary,
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                CustomButton(
                  label: 'Cancel',
                  onPressed: () => Navigator.pop(context),
                  backgroundColor: Theme.of(context).cardTheme.color,

                ),
                CustomButton(
                  label: 'Confirm',
                  onPressed: () {
                    setState(() {
                      _visitReasons = selectedReasons;
                      _checkForChanges();
                    });
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CustomAppBar(
        title: _visit.status == 'visited' ? 'Review Visit' : 'Edit Visit',
        showBackButton: true,
      ),
      drawer: const AppSidebar(),
      body: RefreshIndicator(
        onRefresh: _loadInitialData,
        child:
            _isLoading && !_isInitialized
                ? const Center(child: CustomProgressIndicator())
                : Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: ListView(
                    children: [
                      if (_visit.status != 'visited') ...[
                        CustomCard(
                          title: 'Date & Time',
                          child: Column(
                            children: [
                              CustomListTile(
                                title: _dateController.text,
                                leadingIcon: Icons.calendar_today,
                                onTap: _pickDate,
                              ),
                              const CustomSpacer(height: 12),
                              CustomListTile(
                                title: _timeController.text,
                                leadingIcon: Icons.access_time,
                                onTap: _pickTime,
                              ),
                            ],
                          ),
                        ),
                        const CustomSpacer(height: 16),
                        CustomCard(
                          title: 'Location & Agent',
                          child: Consumer<AgentProvider>(
                            builder: (context, agentProvider, child) {
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  CustomTextField(
                                    controller: _agentPhoneController,
                                    label: 'Enter agent\'s phone number',
                                    prefixIcon: Icons.phone,
                                    keyboardType: TextInputType.number,
                                    validator: (value) {
                                      if (value!.length != 8 ||
                                          !RegExp(
                                            r'^[0-9]+$',
                                          ).hasMatch(value)) {
                                        return 'Enter a valid 8-digit phone number';
                                      }
                                      return null;
                                    },
                                  ),
                                  const CustomSpacer(height: 12),
                                  CustomListTile(
                                    title:
                                        _selectedLocation ?? 'Select Location',
                                    leadingIcon: Icons.location_on,
                                    onTap:
                                        _agentPhoneController.text.isNotEmpty
                                            ? null
                                            : () => _showLocationDialog(
                                              context,
                                              agentProvider,
                                            ),
                                  ),
                                  const CustomSpacer(height: 12),
                                  CustomListTile(
                                    title:
                                        _selectedAgentId == null
                                            ? (_agentPhoneController
                                                    .text
                                                    .isNotEmpty
                                                ? 'Selected via phone'
                                                : _selectedLocation == null
                                                ? 'Select a location first'
                                                : 'Select Agent')
                                            : '${agentProvider.agents.firstWhere((agent) => agent.agentID == _selectedAgentId, orElse: () => Agent(agentID: _selectedAgentId!, name: 'Loading', lastname: '...', location: '')).name} ${agentProvider.agents.firstWhere((agent) => agent.agentID == _selectedAgentId, orElse: () => Agent(agentID: _selectedAgentId!, name: 'Loading', lastname: '...', location: '')).lastname}',
                                    leadingIcon: Icons.person,
                                    onTap:
                                        _agentPhoneController.text.isNotEmpty ||
                                                _selectedLocation == null
                                            ? null
                                            : () => _showAgentDialog(
                                              context,
                                              agentProvider,
                                            ),
                                  ),
                                ],
                              );
                            },
                          ),
                        ),
                      ],
                      if (_visit.status == 'visited' &&
                          _visit.comment != null) ...[
                        const CustomSpacer(height: 16),
                        CustomCard(
                          title: 'Details',
                          child: CustomTextField(
                            controller: _commentController,
                            label: 'Enter comment',
                            prefixIcon: Icons.comment,
                          ),
                        ),
                      ],
                      const CustomSpacer(height: 16),
                      CustomCard(
                        title: 'Checklists',
                        child: Consumer<ChecklistProvider>(
                          builder: (context, checklistProvider, child) {
                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                CustomListTile(
                                  title:
                                      _visitChecklists.isEmpty
                                          ? 'Select Checklists'
                                          : '${_visitChecklists.length} selected',
                                  leadingIcon: Icons.checklist,
                                  onTap:
                                      () => _showChecklistDialog(
                                        context,
                                        checklistProvider,
                                      ),
                                ),
                                if (_visitChecklists.isNotEmpty) ...[
                                  const CustomSpacer(height: 8),
                                  Column(
                                    children:
                                        _visitChecklists.map((checklist) {
                                          return CheckboxListTile(
                                            title: Text(checklist.item),
                                            value:
                                                checklist
                                                    .visitChecklist
                                                    ?.checked ??
                                                false,
                                            onChanged:
                                                _visit.status == 'visited'
                                                    ? (value) =>
                                                        _toggleChecklist(
                                                          checklist,
                                                          value,
                                                        )
                                                    : null,
                                            activeColor:
                                                Theme.of(
                                                  context,
                                                ).colorScheme.primary,
                                            enabled: _visit.status == 'visited',
                                            controlAffinity:
                                                ListTileControlAffinity.leading,
                                            dense: true,
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
                      CustomCard(
                        title: 'Reasons',
                        child: Consumer<ReasonProvider>(
                          builder: (context, reasonProvider, child) {
                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                CustomListTile(
                                  title:
                                      _visitReasons.isEmpty
                                          ? 'Select Reasons'
                                          : '${_visitReasons.length} selected',
                                  leadingIcon: Icons.list_alt,
                                  onTap:
                                      () => _showReasonDialog(
                                        context,
                                        reasonProvider,
                                      ),
                                ),
                                if (_visitReasons.isNotEmpty) ...[
                                  const CustomSpacer(height: 8),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children:
                                        _visitReasons.map((reason) {
                                          return Chip(
                                            label: Text(reason.item),
                                            deleteIcon: const Icon(
                                              Icons.close,
                                              size: 18,
                                            ),
                                            onDeleted:
                                                () => _removeReason(
                                                  reason.reasonID!,
                                                ),
                                            backgroundColor: Theme.of(context).cardTheme.color,

                                            labelStyle: TextStyle(
                                              color:
                                                  Theme.of(
                                                    context,
                                                  ).colorScheme.primary,
                                            ),
                                          );
                                        }).toList(),
                                  ),
                                ],
                              ],
                            );
                          },
                        ),
                      ),
                      if (_visit.photos != null && _visit.photos!.isNotEmpty ||
                          _newPhotos.isNotEmpty) ...[
                        const CustomSpacer(height: 16),
                        CustomCard(
                          title: 'Photos',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (_visit.status == 'visited')
                                CustomButton(
                                  label: 'Add Photo',
                                  onPressed: _addNewPhoto,
                                ),
                              const CustomSpacer(height: 8),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  if (_visit.photos != null)
                                    ..._visit.photos!
                                        .where(
                                          (p) => !_photosToRemove.contains(p),
                                        )
                                        .map((photo) {
                                          return GestureDetector(
                                            onTap:
                                                () =>
                                                    _viewPhotoFullScreen(photo),
                                            child: Stack(
                                              children: [
                                                Image.network(
                                                  photo.startsWith('http')
                                                      ? photo
                                                      : '$baseUrl$photo',
                                                  width: 100,
                                                  height: 100,
                                                  fit: BoxFit.cover,
                                                  errorBuilder:
                                                      (_, __, ___) =>
                                                          const Icon(
                                                            Icons.error,
                                                            size: 100,
                                                          ),
                                                ),
                                                Positioned(
                                                  top: 0,
                                                  right: 0,
                                                  child: CustomIconButton(
                                                    icon: Icons.close,
                                                    onPressed:
                                                        () =>
                                                            _removePhoto(photo),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          );
                                        })
                                        .toList(),
                                  ..._newPhotos.map((photo) {
                                    return GestureDetector(
                                      onTap:
                                          () => Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder:
                                                  (_) => Scaffold(
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
                                                    backgroundColor:
                                                        Colors.black,
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
                                            errorBuilder:
                                                (_, __, ___) => const Icon(
                                                  Icons.error,
                                                  size: 100,
                                                ),
                                          ),
                                          Positioned(
                                            top: 0,
                                            right: 0,
                                            child: CustomIconButton(
                                              icon: Icons.close,
                                              onPressed:
                                                  () => setState(
                                                    () => _newPhotos.remove(
                                                      photo,
                                                    ),
                                                  ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  }).toList(),
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
                          SizedBox(
                            child: CustomButton(
                              label: 'Cancel',
                              onPressed: () {
                                _editStartTime = null;
                                Navigator.pop(context);
                              },
                            ),
                          ),
                          const CustomSpacer(width: 8),
                          SizedBox(
                            child: CustomButton(
                              label: 'Save Changes',
                              onPressed:
                                  _hasChanges ? () => _saveChanges() : () {},
                              isLoading: _isLoading,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
      ),
    );
  }
}
