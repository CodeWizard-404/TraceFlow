import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../models/checklist.dart';
import '../../models/visit.dart';
import '../../models/visit_checklist.dart';
import '../../providers/auth_provider.dart';
import '../../providers/visit_provider.dart';
import '../../providers/checklist_provider.dart';
import '../Error.dart';

class LogVisitScreen extends StatefulWidget {
  final String visitID;
  final int weekNumber;
  final int year;

  const LogVisitScreen({
    super.key,
    required this.visitID,
    required this.weekNumber,
    required this.year,
  });

  @override
  _LogVisitScreenState createState() => _LogVisitScreenState();
}

class _LogVisitScreenState extends State<LogVisitScreen>
    with WidgetsBindingObserver {
  late CameraController _cameraController;
  bool _isCameraInitialized = false;
  bool _isCameraActive = false;
  List<Checklist> _checklists = [];
  List<XFile> _photos = [];
  String _comment = '';
  DateTime? _entryTime;
  Visit? _visit;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initializeCamera();
    _fetchVisitData();
    _entryTime = DateTime.now();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _isCameraInitialized) {
      _cameraController.initialize().then((_) {
        if (mounted) setState(() {});
      });
    }
  }

  Future<void> _initializeCamera() async {
    final cameras = await availableCameras();
    _cameraController = CameraController(
      cameras.firstWhere(
        (camera) => camera.lensDirection == CameraLensDirection.back,
      ),
      ResolutionPreset.high,
      enableAudio: false,
    );
    await _cameraController.initialize();
    setState(() {
      _isCameraInitialized = true;
    });
  }

  Future<void> _fetchVisitData() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final visitProvider = Provider.of<VisitProvider>(context, listen: false);
    final checklistProvider = Provider.of<ChecklistProvider>(
      context,
      listen: false,
    );

    if (authProvider.token == null) {
      _showError('No authentication token found');
      return;
    }

    try {
      await Future.wait([
        visitProvider.fetchVisitById(widget.visitID, authProvider.token!),
        checklistProvider.getChecklistsByVisitId(
          widget.visitID,
          authProvider.token!,
        ),
      ]);
      setState(() {
        _visit = visitProvider.currentVisit;
        _checklists = checklistProvider.checklists;
      });
    } catch (error) {
      _showError('Failed to load visit data: $error');
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cameraController.dispose();
    super.dispose();
  }

  void _showError(String message) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder:
            (_) => ErrorPage(
              errorMessage: message,
              onRetry: () {
                Navigator.pop(context);
                _fetchVisitData();
              },
            ),
      ),
    );
  }

  Future<void> _startCamera() async {
    if (!_isCameraInitialized) return;
    await _cameraController.setFlashMode(FlashMode.off);
    setState(() {
      _isCameraActive = true;
    });
  }

  void _stopCamera() {
    setState(() {
      _isCameraActive = false;
    });
  }

  Future<void> _capturePhoto() async {
    if (!_isCameraInitialized || !_isCameraActive) return;
    try {
      final photo = await _cameraController.takePicture();
      setState(() {
        _photos.add(photo);
      });
    } catch (e) {
      _showSnackBar('Error capturing photo: $e');
    }
  }

  void _removePhoto(int index) {
    setState(() {
      _photos.removeAt(index);
    });
  }

  void _viewPhotoFullScreen(XFile photo) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder:
            (_) => Scaffold(
              appBar: AppBar(
                backgroundColor: Colors.black,
                leading: IconButton(
                  icon: const Icon(Icons.close, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                ),
              ),
              body: Center(
                child: Image.file(
                  File(photo.path),
                  fit: BoxFit.contain,
                  errorBuilder:
                      (_, __, ___) => const Icon(
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

  void _toggleChecklist(String checklistId, bool checked) {
    setState(() {
      final index = _checklists.indexWhere((c) => c.checklistID == checklistId);
      if (index != -1) {
        _checklists[index] = Checklist(
          checklistID: checklistId,
          item: _checklists[index].item,
          visitChecklist: VisitChecklist(
            checked: checked,
            visitID: widget.visitID,
            checklistID: checklistId,
          ),
        );
      }
    });
  }

  Future<void> _validateVisit() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final visitProvider = Provider.of<VisitProvider>(context, listen: false);

    if (authProvider.token == null) {
      _showError('No authentication token found');
      return;
    }

    if (_photos.isEmpty) {
      _showSnackBar('At least one photo is required');
      return;
    }

    try {
      final duration =
          _entryTime != null
              ? DateTime.now().difference(_entryTime!).inMinutes
              : 0;

      final checklistUpdates =
          _checklists
              .map(
                (c) => {
                  'id': c.checklistID,
                  'checked': c.visitChecklist?.checked ?? false,
                },
              )
              .toList();

      await visitProvider.logVisit(
        visitId: widget.visitID,
        token: authProvider.token!,
        duration: duration,
        checklistUpdates: checklistUpdates,
        photoPaths: _photos.map((p) => p.path).toList(),
        comment: _comment,
      );

      _stopCamera();
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Visit validated successfully')),
      );
    } catch (error) {
      _showError('Failed to validate visit: $error');
    }
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red.withOpacity(0.9),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final visitProvider = Provider.of<VisitProvider>(context);
    final checklistProvider = Provider.of<ChecklistProvider>(context);

    return Scaffold(
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(80.0),
        child: AppBar(
          title: const Text(
            'Log Visit',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          centerTitle: true,
          flexibleSpace: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Theme.of(context).colorScheme.primary,
                  Theme.of(context).colorScheme.secondary,
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
          ),
        ),
      ),
      body:
          visitProvider.isLoading ||
                  checklistProvider.isLoading ||
                  !_isCameraInitialized
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                onRefresh: _fetchVisitData,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16.0),
                  physics: const AlwaysScrollableScrollPhysics(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (!_isCameraActive) ...[
                        _buildGlassCard(
                          context,
                          title: 'Visit Details',
                          icon: Icons.person,
                          content: [
                            _buildDetailRow(
                              context,
                              'Agent ID:',
                              _visit?.agentID ?? 'N/A',
                            ),
                            _buildDetailRow(
                              context,
                              'Location:',
                              _visit?.location ?? 'N/A',
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        _buildGlassCard(
                          context,
                          title: 'Reasons',
                          icon: Icons.question_answer,
                          content:
                              _visit?.reasons?.isEmpty ?? true
                                  ? [const Text('No reasons specified')]
                                  : _visit!.reasons!
                                      .map((r) => Text(r.item ?? 'N/A'))
                                      .toList(),
                        ),
                        const SizedBox(height: 16),
                      ],
                      _buildGlassCard(
                        context,
                        title: 'Camera & Photos',
                        icon: Icons.camera_alt,
                        content: [
                          if (!_isCameraActive)
                            ElevatedButton(
                              onPressed: _startCamera,
                              style: ElevatedButton.styleFrom(
                                backgroundColor:
                                    Theme.of(context).colorScheme.primary,
                                foregroundColor:
                                    Theme.of(context).colorScheme.onPrimary,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              child: const Text('Start Camera'),
                            )
                          else ...[
                            SizedBox(
                              height: MediaQuery.of(context).size.height * 0.8,
                              child: CameraPreview(_cameraController),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                              children: [
                                ElevatedButton(
                                  onPressed: _stopCamera,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.red,
                                    foregroundColor: Colors.white,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                  child: const Text('Stop Camera'),
                                ),
                                ElevatedButton(
                                  onPressed: _capturePhoto,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor:
                                        Theme.of(context).colorScheme.primary,
                                    foregroundColor:
                                        Theme.of(context).colorScheme.onPrimary,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                  child: const Text('Capture Photo'),
                                ),
                              ],
                            ),
                            if (_photos.isNotEmpty) ...[
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children:
                                    _photos.asMap().entries.map((entry) {
                                      final index = entry.key;
                                      final photo = entry.value;
                                      return GestureDetector(
                                        onTap:
                                            () => _viewPhotoFullScreen(photo),
                                        child: Stack(
                                          children: [
                                            Image.file(
                                              File(photo.path),
                                              width: 100,
                                              height: 100,
                                              fit: BoxFit.cover,
                                            ),
                                            Positioned(
                                              top: 0,
                                              right: 0,
                                              child: IconButton(
                                                icon: const Icon(
                                                  Icons.close,
                                                  color: Colors.red,
                                                ),
                                                onPressed:
                                                    () => _removePhoto(index),
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    }).toList(),
                              ),
                            ],
                          ],
                        ],
                      ),
                      if (!_isCameraActive) ...[
                        const SizedBox(height: 16),
                        _buildGlassCard(
                          context,
                          title:
                              'Checklist (${_checklists.where((c) => c.visitChecklist?.checked ?? false).length}/${_checklists.length})',
                          icon: Icons.checklist,
                          content:
                              _checklists.isEmpty
                                  ? [const Text('No checklist items available')]
                                  : _checklists
                                      .map(
                                        (c) => CheckboxListTile(
                                          title: Text(c.item ?? 'N/A'),
                                          value:
                                              c.visitChecklist?.checked ??
                                              false,
                                          onChanged:
                                              (value) => _toggleChecklist(
                                                c.checklistID!,
                                                value ?? false,
                                              ),
                                          activeColor:
                                              Theme.of(
                                                context,
                                              ).colorScheme.primary,
                                          controlAffinity:
                                              ListTileControlAffinity.leading,
                                          dense: true,
                                        ),
                                      )
                                      .toList(),
                        ),
                        const SizedBox(height: 16),
                        _buildGlassCard(
                          context,
                          title: 'Comment',
                          icon: Icons.comment,
                          content: [
                            TextField(
                              onChanged: (value) => _comment = value,
                              decoration: InputDecoration(
                                labelText: 'Add a comment (optional)',
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              maxLines: 3,
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            _buildActionButton(
                              context,
                              icon: Icons.check,
                              label: 'Validate Visit',
                              onPressed: _validateVisit,
                            ),
                            _buildActionButton(
                              context,
                              icon: Icons.arrow_back,
                              label: 'Back',
                              onPressed: () {
                                _stopCamera();
                                Navigator.pop(context);
                              },
                              gradientColors: [
                                Colors.grey,
                                Colors.grey.shade700,
                              ],
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
    );
  }

  Widget _buildGlassCard(
    BuildContext context, {
    required String title,
    required IconData icon,
    required List<Widget> content,
  }) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Theme.of(context).colorScheme.surface.withOpacity(0.9),
            Theme.of(context).colorScheme.surface.withOpacity(0.7),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Theme.of(
                      context,
                    ).colorScheme.primary.withOpacity(0.1),
                  ),
                  child: Icon(
                    icon,
                    color: Theme.of(context).colorScheme.primary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Text(title, style: Theme.of(context).textTheme.headlineSmall),
              ],
            ),
            const SizedBox(height: 16),
            ...content,
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(value, style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback onPressed,
    List<Color> gradientColors = const [],
  }) {
    final colors =
        gradientColors.isNotEmpty
            ? gradientColors
            : [
              Theme.of(context).colorScheme.primary,
              Theme.of(context).colorScheme.secondary,
            ];
    return GestureDetector(
      onTap: onPressed,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: colors,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: colors[0].withOpacity(0.4),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: Theme.of(context).colorScheme.onPrimary,
              size: 20,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
