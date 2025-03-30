import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart'; // Add this for camera
import 'dart:io'; // For File
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
  List<File> _newPhotos = []; // Store new photos taken by camera
  bool _isLoading = false;
  bool _isInitialized = false;
  DateTime? _editStartTime;
  int _additionalDuration = 0;

  @override
  void initState() {
    super.initState();
    _visit = widget.visit;
    _dateController = TextEditingController(text: DateFormat('yyyy-MM-dd').format(_visit.date));
    _timeController = TextEditingController(text: _visit.time);
    _agentPhoneController = TextEditingController();
    _commentController = TextEditingController(text: _visit.comment ?? '');
    _selectedLocation = _visit.location;
    _selectedAgentId = _visit.agentID;
    _visitChecklists = _visit.checklists != null ? List.from(_visit.checklists!) : [];
    _visitReasons = _visit.reasons != null ? List.from(_visit.reasons!) : [];

    _agentPhoneController.addListener(_onPhoneNumberChanged);

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
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final token = authProvider.token;
      if (token == null) throw Exception('No authentication token');

      final checklistProvider = Provider.of<ChecklistProvider>(context, listen: false);
      final reasonProvider = Provider.of<ReasonProvider>(context, listen: false);
      final agentProvider = Provider.of<AgentProvider>(context, listen: false);

      await Future.wait([
        checklistProvider.getAllChecklists(token),
        reasonProvider.getAllReasons(token),
        agentProvider.fetchUniqueLocations(token),
        if (_selectedLocation != null) agentProvider.fetchAgentsByLocation(_selectedLocation!, token),
      ]);

      if (agentProvider.agents.isNotEmpty && !agentProvider.agents.any((a) => a.agentID == _selectedAgentId)) {
        setState(() => _selectedAgentId = agentProvider.agents.first.agentID);
      }

      _isInitialized = true;
    } catch (e) {
      _showSnackBar('Failed to load initial data: $e');
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
    return ((diffDays + 1) / 7).ceil();
  }

  Future<void> _saveChanges() async {
    if (_isLoading) return;

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
        await agentProvider.fetchAgentByPhone(_agentPhoneController.text, token);
        agentId = agentProvider.currentAgent?.agentID ?? _selectedAgentId;
      }

      final checklistUpdates = _visitChecklists
          .map((c) => {
        'id': c.checklistID,
        'checked': c.visitChecklist?.checked ?? false,
      })
          .toList();

      final reasonUpdates = _visitReasons.map((r) => {'id': r.reasonID}).toList();

      int? updatedDuration = _visit.duration;
      if (_visit.status == 'visited' && _editStartTime != null) {
        _additionalDuration = DateTime.now().difference(_editStartTime!).inMinutes;
        updatedDuration = (_visit.duration ?? 0) + _additionalDuration;
      }

      final newStatus = _visit.status == 'visited' ? 'visited' : 'pending';
      final formattedDate = _visit.status == 'visited'
          ? DateFormat('yyyy-MM-dd').format(_visit.date)
          : _dateController.text;

      // Handle new photos (assuming VisitProvider.uploadPhotos returns paths)
      List<String> newPhotoPaths = [];
      if (_newPhotos.isNotEmpty) {
        newPhotoPaths = await visitProvider.uploadPhotos(_newPhotos, _visit.visitID!, token);
      }

      await visitProvider.updateVisit(
        visitId: _visit.visitID!,
        date: formattedDate,
        time: _visit.status == 'visited' ? _visit.time : _timeController.text,
        location: _visit.status == 'visited' ? _visit.location : _selectedLocation,
        status: newStatus,
        comment: _visit.status == 'visited' && _commentController.text.isNotEmpty ? _commentController.text : _visit.comment,
        agentID: _visit.status == 'visited' ? _visit.agentID : agentId,
        checklists: checklistUpdates,
        reasons: reasonUpdates,
        photoPaths: _photosToRemove.isNotEmpty ? _photosToRemove : null,
        newPhotos: newPhotoPaths.isNotEmpty ? newPhotoPaths : null, // Send new photos
        duration: updatedDuration,
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

      if (selectedDate.weekday == DateTime.saturday || selectedDate.weekday == DateTime.sunday) {
        _showSnackBar('Date cannot be a Saturday or Sunday');
        return false;
      }
      if (selectedDate.isBefore(DateTime(now.year, now.month, now.day))) {
        _showSnackBar('Date cannot be before today');
        return false;
      }

      final startTime = DateTime(selectedDate.year, selectedDate.month, selectedDate.day, 8, 0);
      final endTime = DateTime(selectedDate.year, selectedDate.month, selectedDate.day, 17, 0);
      if (selectedDateTime.isBefore(startTime) || selectedDateTime.isAfter(endTime)) {
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
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    }
  }

  void _toggleChecklist(Checklist checklist, bool? value) {
    if (_visit.status != 'visited') return; // Only for 'visited'
    setState(() {
      final index = _visitChecklists.indexWhere((c) => c.checklistID == checklist.checklistID);
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
    });
  }

  void _addChecklist(Checklist checklist) {
    if (!_visitChecklists.any((c) => c.checklistID == checklist.checklistID)) {
      setState(() {
        _visitChecklists.add(Checklist(
          checklistID: checklist.checklistID,
          item: checklist.item,
          visitChecklist: VisitChecklist(
            checked: false,
            visitID: _visit.visitID,
            checklistID: checklist.checklistID,
          ),
        ));
      });
    }
  }

  void _removeChecklist(String checklistId) {
    setState(() => _visitChecklists.removeWhere((c) => c.checklistID == checklistId));
  }

  void _addReason(Reason reason) {
    if (!_visitReasons.any((r) => r.reasonID == reason.reasonID)) {
      setState(() => _visitReasons.add(reason));
    }
  }

  void _removeReason(String reasonId) {
    setState(() => _visitReasons.removeWhere((r) => r.reasonID == reasonId));
  }

  void _removePhoto(String photo) {
    setState(() => _photosToRemove.add(photo));
  }

  Future<void> _addNewPhoto() async {
    if (_visit.status != 'visited') return; // Only for 'visited'
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
          appBar: AppBar(
            backgroundColor: Colors.black,
            leading: IconButton(
              icon: const Icon(Icons.close, color: Colors.white),
              onPressed: () => Navigator.pop(context),
            ),
          ),
          body: Center(
            child: Image.network(
              photoPath.startsWith('http') ? photoPath : '$baseUrl$photoPath',
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) => const Icon(Icons.error, color: Colors.white, size: 50),
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
      selectableDayPredicate: (DateTime date) => date.weekday != DateTime.saturday && date.weekday != DateTime.sunday,
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
      setState(() => _dateController.text = DateFormat('yyyy-MM-dd').format(date));
    }
  }

  Future<void> _pickTime() async {
    final now = DateTime.now();
    final initialTime = TimeOfDay.fromDateTime(DateFormat('HH:mm').parse(_timeController.text));
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
      final selectedDateTime = DateTime(selectedDate.year, selectedDate.month, selectedDate.day, time.hour, time.minute);
      final isToday = selectedDate.day == now.day;

      if (time.hour < 8 || time.hour >= 17 || (time.hour == 17 && time.minute > 0)) {
        _showSnackBar('Time must be between 08:00 and 17:00');
        return;
      }
      if (isToday && selectedDateTime.isBefore(now)) {
        _showSnackBar('Time cannot be before now for today');
        return;
      }

      setState(() => _timeController.text = '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}');
    }
  }

  Future<void> _showLocationDialog(BuildContext context, AgentProvider agentProvider) async {
    final locations = agentProvider.uniqueLocations;
    final TextEditingController searchController = TextEditingController();
    List<String> filteredLocations = List.from(locations);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
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
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 300,
                      child: ListView.builder(
                        itemCount: filteredLocations.length,
                        itemBuilder: (context, index) {
                          final location = filteredLocations[index];
                          return RadioListTile<String>(
                            title: Text(location),
                            value: location,
                            groupValue: _selectedLocation,
                            onChanged: (value) {
                              setState(() {
                                _selectedLocation = value;
                                _selectedAgentId = null;
                                agentProvider.fetchAgentsByLocation(value!, Provider.of<AuthProvider>(context, listen: false).token!);
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
                  child: Text('Cancel', style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6))),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _showAgentDialog(BuildContext context, AgentProvider agentProvider) async {
    final agents = agentProvider.agents;
    final TextEditingController searchController = TextEditingController();
    List<Agent> filteredAgents = List.from(agents);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
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
                    const SizedBox(height: 12),
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
                  onPressed: () => Navigator.pop(context),
                  child: Text('Cancel', style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6))),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _showChecklistDialog(BuildContext context, ChecklistProvider checklistProvider) async {
    final allChecklists = checklistProvider.allChecklists;
    final selectedChecklists = List<Checklist>.from(_visitChecklists);
    final TextEditingController searchController = TextEditingController();
    List<Checklist> filteredChecklists = List.from(allChecklists);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
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
                    const SizedBox(height: 12),
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
                                  selectedChecklists.add(Checklist(
                                    checklistID: checklist.checklistID,
                                    item: checklist.item,
                                    visitChecklist: VisitChecklist(
                                      checked: false,
                                      visitID: _visit.visitID,
                                      checklistID: checklist.checklistID,
                                    ),
                                  ));
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
                  onPressed: () => Navigator.pop(context),
                  child: Text('Cancel', style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6))),
                ),
                ElevatedButton(
                  onPressed: () {
                    setState(() => _visitChecklists = selectedChecklists);
                    Navigator.pop(context);
                  },
                  style: Theme.of(context).elevatedButtonTheme.style,
                  child: Text('Confirm', style: TextStyle(color: Theme.of(context).colorScheme.onPrimary)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _showReasonDialog(BuildContext context, ReasonProvider reasonProvider) async {
    final allReasons = reasonProvider.allReasons;
    final selectedReasons = List<Reason>.from(_visitReasons);
    final TextEditingController searchController = TextEditingController();
    List<Reason> filteredReasons = List.from(allReasons);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
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
                    const SizedBox(height: 12),
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
                  onPressed: () => Navigator.pop(context),
                  child: Text('Cancel', style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6))),
                ),
                ElevatedButton(
                  onPressed: () {
                    setState(() => _visitReasons = selectedReasons);
                    Navigator.pop(context);
                  },
                  style: Theme.of(context).elevatedButtonTheme.style,
                  child: Text('Confirm', style: TextStyle(color: Theme.of(context).colorScheme.onPrimary)),
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
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(80),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Theme.of(context).colorScheme.primary,
                Theme.of(context).colorScheme.secondary,
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(20)),
          ),
          child: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            title: Text(
              _visit.status == 'visited' ? 'Review Visit' : 'Edit Visit',
              style: Theme.of(context).appBarTheme.titleTextStyle,
            ),
            centerTitle: true,
            leading: IconButton(
              icon: Icon(Icons.arrow_back_ios_rounded, color: Theme.of(context).appBarTheme.iconTheme!.color, size: 24),
              onPressed: () => Navigator.pop(context),
            ),
            actions: [
              if (_isLoading)
                const Padding(
                  padding: EdgeInsets.all(8.0),
                  child: CircularProgressIndicator(color: Colors.white),
                ),
            ],
          ),
        ),
      ),
      body: Container(
        color: Theme.of(context).scaffoldBackgroundColor,
        child: Padding(
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
                      const SizedBox(height: 12),
                      _buildTile(
                        icon: Icons.access_time,
                        title: _timeController.text,
                        onTap: _pickTime,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
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
                              border: Border.all(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.phone, color: Theme.of(context).colorScheme.primary, size: 24),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: TextField(
                                    controller: _agentPhoneController,
                                    keyboardType: TextInputType.number,
                                    inputFormatters: [
                                      FilteringTextInputFormatter.digitsOnly,
                                    ],
                                    maxLength: 8,
                                    decoration: InputDecoration(
                                      hintText: 'Enter agent\'s phone number',
                                      border: InputBorder.none,
                                      hintStyle: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
                                      counterText: '',
                                    ),
                                    style: TextStyle(fontSize: 16, color: Theme.of(context).colorScheme.onSurface),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                          GestureDetector(
                            onTap: _agentPhoneController.text.isNotEmpty ? null : () => _showLocationDialog(context, agentProvider),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surface,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
                                backgroundBlendMode: _agentPhoneController.text.isNotEmpty ? BlendMode.saturation : null,
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.location_on,
                                    color: _agentPhoneController.text.isNotEmpty
                                        ? Theme.of(context).colorScheme.onSurface.withOpacity(0.6)
                                        : Theme.of(context).colorScheme.primary,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      _selectedLocation ??
                                          (_agentPhoneController.text.isNotEmpty ? 'Selected via phone' : 'Select Location'),
                                      style: TextStyle(
                                        color: _agentPhoneController.text.isNotEmpty
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
                          const SizedBox(height: 12),
                          GestureDetector(
                            onTap: _agentPhoneController.text.isNotEmpty || _selectedLocation == null
                                ? null
                                : () => _showAgentDialog(context, agentProvider),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surface,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
                                backgroundBlendMode:
                                _agentPhoneController.text.isNotEmpty || _selectedLocation == null ? BlendMode.saturation : null,
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.person,
                                    color: _agentPhoneController.text.isNotEmpty || _selectedLocation == null
                                        ? Theme.of(context).colorScheme.onSurface.withOpacity(0.6)
                                        : Theme.of(context).colorScheme.primary,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      _selectedAgentId == null
                                          ? (_agentPhoneController.text.isNotEmpty
                                          ? 'Selected via phone'
                                          : _selectedLocation == null
                                          ? 'Select a location first'
                                          : 'Select Agent')
                                          : '${agentProvider.agents.firstWhere(
                                            (agent) => agent.agentID == _selectedAgentId,
                                        orElse: () => Agent(agentID: _selectedAgentId!, name: 'Loading', lastname: '...', location: ''),
                                      ).name} ${agentProvider.agents.firstWhere(
                                            (agent) => agent.agentID == _selectedAgentId,
                                        orElse: () => Agent(agentID: _selectedAgentId!, name: 'Loading', lastname: '...', location: ''),
                                      ).lastname}',
                                      style: TextStyle(
                                        color: _agentPhoneController.text.isNotEmpty || _selectedLocation == null
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
              ],
              if (_visit.status == 'visited' && _visit.comment != null) ...[
                const SizedBox(height: 16),
                _buildSectionCard(
                  title: 'Details',
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.comment, color: Theme.of(context).colorScheme.primary, size: 24),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextField(
                            controller: _commentController,
                            decoration: InputDecoration(
                              hintText: 'Enter comment',
                              border: InputBorder.none,
                              hintStyle: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
                            ),
                            style: TextStyle(fontSize: 16, color: Theme.of(context).colorScheme.onSurface),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              _buildSectionCard(
                title: 'Checklists',
                child: Consumer<ChecklistProvider>(
                  builder: (context, checklistProvider, child) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_visit.status != 'visited') // Selector for non-'visited'
                          GestureDetector(
                            onTap: () => _showChecklistDialog(context, checklistProvider),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surface,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
                              ),
                              child: Row(
                                children: [
                                  Icon(Icons.checklist, color: Theme.of(context).colorScheme.primary),
                                  const SizedBox(width: 12),
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
                          const SizedBox(height: 8),
                          Column(
                            children: _visitChecklists.map((checklist) {
                              return CheckboxListTile(
                                title: Text(checklist.item),
                                value: checklist.visitChecklist?.checked ?? false,
                                onChanged: _visit.status == 'visited'
                                    ? (value) => _toggleChecklist(checklist, value)
                                    : null,
                                activeColor: Theme.of(context).colorScheme.primary,
                                enabled: _visit.status == 'visited',
                                controlAffinity: ListTileControlAffinity.leading,
                                dense: true,
                              );
                            }).toList(),
                          ),
                        ] else if (_visit.status == 'visited')
                          Text(
                            'No checklists available',
                            style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
                          ),
                      ],
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),
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
                              border: Border.all(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.list_alt, color: Theme.of(context).colorScheme.primary),
                                const SizedBox(width: 12),
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
                        if (_visitReasons.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _visitReasons.map((reason) {
                              return Chip(
                                label: Text(reason.item),
                                deleteIcon: const Icon(Icons.close, size: 18),
                                onDeleted: () => _removeReason(reason.reasonID!),
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
              if (_visit.photos != null || _newPhotos.isNotEmpty) ...[
                const SizedBox(height: 16),
                _buildSectionCard(
                  title: 'Photos',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_visit.status == 'visited')
                        ElevatedButton.icon(
                          onPressed: _addNewPhoto,
                          icon: const Icon(Icons.camera_alt),
                          label: const Text('Take Photo'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Theme.of(context).colorScheme.primary,
                            foregroundColor: Theme.of(context).colorScheme.onPrimary,
                          ),
                        ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          // Existing photos
                          if (_visit.photos != null)
                            ..._visit.photos!.where((p) => !_photosToRemove.contains(p)).map((photo) {
                              return GestureDetector(
                                onTap: () => _viewPhotoFullScreen(photo),
                                child: Stack(
                                  children: [
                                    Image.network(
                                      photo.startsWith('http') ? photo : '$baseUrl$photo',
                                      width: 100,
                                      height: 100,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => const Icon(Icons.error, size: 100),
                                    ),
                                    Positioned(
                                      top: 0,
                                      right: 0,
                                      child: IconButton(
                                        icon: const Icon(Icons.close, color: Colors.red),
                                        onPressed: () => _removePhoto(photo),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
                          // New photos from camera
                          ..._newPhotos.map((photo) {
                            return GestureDetector(
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => Scaffold(
                                    appBar: AppBar(
                                      backgroundColor: Colors.black,
                                      leading: IconButton(
                                        icon: const Icon(Icons.close, color: Colors.white),
                                        onPressed: () => Navigator.pop(context),
                                      ),
                                    ),
                                    body: Center(
                                      child: Image.file(
                                        photo,
                                        fit: BoxFit.contain,
                                        errorBuilder: (_, __, ___) => const Icon(Icons.error, color: Colors.white, size: 50),
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
                                    errorBuilder: (_, __, ___) => const Icon(Icons.error, size: 100),
                                  ),
                                  Positioned(
                                    top: 0,
                                    right: 0,
                                    child: IconButton(
                                      icon: const Icon(Icons.close, color: Colors.red),
                                      onPressed: () => setState(() => _newPhotos.remove(photo)),
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
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _saveChanges,
                style: Theme.of(context).elevatedButtonTheme.style,
                child: Text(
                  'Save Changes',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Theme.of(context).colorScheme.onPrimary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionCard({required String title, required Widget child}) {
    return Card(
      elevation: 2,
      shape: Theme.of(context).cardTheme.shape,
      color: Theme.of(context).cardTheme.color,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }

  Widget _buildTile({required IconData icon, required String title, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2)),
        ),
        child: Row(
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            Icon(Icons.arrow_drop_down, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
          ],
        ),
      ),
    );
  }
}